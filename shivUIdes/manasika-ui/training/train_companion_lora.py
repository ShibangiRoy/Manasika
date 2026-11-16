"""Train a real SmolLM2 LoRA adapter without modifying the base model weights."""

from __future__ import annotations

import argparse
import json
import math
import os
import random
from pathlib import Path

import torch
from peft import LoraConfig, get_peft_model
from torch.utils.data import Dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, Trainer, TrainingArguments


APP_ROOT = Path(__file__).resolve().parents[1]
BASE_MODEL = "HuggingFaceTB/SmolLM2-135M-Instruct"


class CompanionDataset(Dataset):
    def __init__(self, rows: list[dict], tokenizer, max_length: int):
        self.examples = []
        answer_limit = min(512, max_length // 2)
        prompt_limit = max_length - answer_limit
        for row in rows:
            messages = row["messages"]
            prompt = tokenizer.apply_chat_template(
                messages[:-1], tokenize=False, add_generation_prompt=True
            )
            prompt_ids = tokenizer.encode(prompt, add_special_tokens=False)
            answer_ids = tokenizer.encode(messages[-1]["content"], add_special_tokens=False)
            if tokenizer.eos_token_id is not None:
                answer_ids.append(tokenizer.eos_token_id)
            if len(prompt_ids) > prompt_limit:
                keep_head = min(256, prompt_limit // 2)
                prompt_ids = prompt_ids[:keep_head] + prompt_ids[-(prompt_limit - keep_head):]
            answer_ids = answer_ids[:answer_limit]
            input_ids = prompt_ids + answer_ids
            labels = [-100] * len(prompt_ids) + answer_ids
            self.examples.append({"input_ids": input_ids, "attention_mask": [1] * len(input_ids), "labels": labels})

    def __len__(self):
        return len(self.examples)

    def __getitem__(self, index):
        return self.examples[index]


class ResponseOnlyCollator:
    def __init__(self, pad_id: int):
        self.pad_id = pad_id

    def __call__(self, rows):
        width = max(len(row["input_ids"]) for row in rows)
        input_ids, attention_mask, labels = [], [], []
        for row in rows:
            padding = width - len(row["input_ids"])
            input_ids.append(row["input_ids"] + [self.pad_id] * padding)
            attention_mask.append(row["attention_mask"] + [0] * padding)
            labels.append(row["labels"] + [-100] * padding)
        return {
            "input_ids": torch.tensor(input_ids, dtype=torch.long),
            "attention_mask": torch.tensor(attention_mask, dtype=torch.long),
            "labels": torch.tensor(labels, dtype=torch.long),
        }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=APP_ROOT / "training" / "data" / "companion.jsonl")
    parser.add_argument("--output", type=Path, default=APP_ROOT / "training" / "output" / "companion-smollm2-135m-lora")
    parser.add_argument("--base-model", default=BASE_MODEL)
    parser.add_argument("--epochs", type=float, default=1.0)
    parser.add_argument("--max-length", type=int, default=2048)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--gradient-accumulation", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=1e-4)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max-examples", type=int, default=0, help="Randomly select a balanced pilot subset; 0 uses all examples.")
    args = parser.parse_args()
    if not args.data.exists():
        raise SystemExit("Training data not found. Run prepare_companion_data.py first.")
    args.output.mkdir(parents=True, exist_ok=True)
    with args.data.open(encoding="utf-8") as source:
        rows = [json.loads(line) for line in source if line.strip()]
    if len(rows) < 10:
        raise SystemExit(f"Only {len(rows)} examples found. At least 10 are required for a training run.")
    if args.max_examples > 0 and args.max_examples < len(rows):
        random.Random(args.seed).shuffle(rows)
        rows = rows[:args.max_examples]

    torch.set_num_threads(max(1, min(8, os.cpu_count() or 1)))
    cuda = torch.cuda.is_available()
    bf16 = cuda and torch.cuda.is_bf16_supported()
    dtype = torch.bfloat16 if bf16 else torch.float16 if cuda else torch.float32
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, use_fast=True)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(args.base_model, dtype=dtype)
    model.config.use_cache = False
    model.enable_input_require_grads()
    lora = LoraConfig(
        task_type="CAUSAL_LM",
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )
    model = get_peft_model(model, lora)
    model.print_trainable_parameters()
    dataset = CompanionDataset(rows, tokenizer, args.max_length)
    effective_batch = args.batch_size * args.gradient_accumulation
    total_steps = math.ceil(len(dataset) / effective_batch * args.epochs)
    training = TrainingArguments(
        output_dir=str(args.output / "checkpoints"),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.gradient_accumulation,
        learning_rate=args.learning_rate,
        warmup_steps=max(1, math.ceil(total_steps * 0.03)),
        weight_decay=0.01,
        logging_steps=10,
        save_strategy="epoch",
        save_total_limit=2,
        gradient_checkpointing=True,
        fp16=cuda and not bf16,
        bf16=bf16,
        use_cpu=not cuda,
        dataloader_num_workers=0,
        dataloader_pin_memory=False,
        report_to="none",
        seed=args.seed,
        optim="adamw_torch",
    )
    trainer = Trainer(
        model=model,
        args=training,
        train_dataset=dataset,
        data_collator=ResponseOnlyCollator(tokenizer.pad_token_id),
        processing_class=tokenizer,
    )
    result = trainer.train()
    model.save_pretrained(args.output)
    tokenizer.save_pretrained(args.output)
    (args.output / "training-result.json").write_text(json.dumps({
        "base_model": args.base_model,
        "examples": len(dataset),
        "epochs": args.epochs,
        "train_metrics": result.metrics,
        "adapter_type": "LoRA",
        "created_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    }, indent=2, default=float), encoding="utf-8")
    print(f"LoRA adapter saved to {args.output}")


if __name__ == "__main__":
    main()
