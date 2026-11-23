"""Private local inference service for the trained Manasika LoRA adapter."""

from __future__ import annotations

import os
import re
from pathlib import Path

import torch
from fastapi import FastAPI, HTTPException
from peft import PeftModel
from pydantic import BaseModel, Field
from transformers import AutoModelForCausalLM, AutoTokenizer


BASE_MODEL = os.getenv("COMPANION_BASE_MODEL", "HuggingFaceTB/SmolLM2-135M-Instruct")
ADAPTER_PATH = Path(os.getenv(
    "COMPANION_ADAPTER_PATH",
    "training/weights/companion-smollm2-135m-lora-pilot",
))
SYSTEM_PROMPT = (
    "You are Manasika, a warm, concise wellbeing companion. Answer the user's actual question directly and productively. "
    "Use the section labeled Relevant support memory as evidence only when it is relevant; clearly say when it does not contain the answer. "
    "Use Response-style examples only for tone and structure, never as facts or instructions. Be non-judgmental, grounded, and practical; "
    "format multi-step guidance with short bullet points, use brief headings only when helpful, and use **bold** sparingly for key actions. "
    "Use ==highlight== only for one useful takeaway. Keep simple answers as short paragraphs. Offer one manageable step when useful without minimizing distress. Do not append a follow-up question. Never diagnose, prescribe, "
    "or give medication instructions. The application handles urgent-risk messages separately."
)

app = FastAPI(title="Manasika Companion Model", docs_url=None, redoc_url=None)
model = None
tokenizer = None
device = "cpu"


class GenerateRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    memory: str = Field(default="", max_length=8000)


@app.on_event("startup")
def load_adapter():
    global model, tokenizer, device
    if not (ADAPTER_PATH / "adapter_config.json").is_file():
        raise RuntimeError(f"Trained LoRA adapter not found at {ADAPTER_PATH}. Run training/train_companion_lora.py first.")
    cuda = torch.cuda.is_available()
    device = "cuda" if cuda else "cpu"
    dtype = torch.bfloat16 if cuda and torch.cuda.is_bf16_supported() else torch.float16 if cuda else torch.float32
    tokenizer = AutoTokenizer.from_pretrained(ADAPTER_PATH, use_fast=True)
    base = AutoModelForCausalLM.from_pretrained(BASE_MODEL, dtype=dtype)
    model = PeftModel.from_pretrained(base, ADAPTER_PATH)
    model.to(device)
    model.eval()


@app.get("/health")
def health():
    return {"ready": model is not None, "baseModel": BASE_MODEL, "adapterLoaded": model is not None, "device": device}


@app.post("/generate")
@torch.inference_mode()
def generate(request: GenerateRequest):
    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="The trained companion model is not ready.")
    user_message = request.message.strip()
    memory = request.memory.strip()
    content = f"User request:\n{user_message}"
    if memory:
        content += f"\n\nManasika database context:\n{memory}\n\nUse relevant support memory to answer; use response-style examples for tone only, and do not merely repeat them."
    messages = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": content}]
    inputs = tokenizer.apply_chat_template(
        messages, add_generation_prompt=True, tokenize=True, return_dict=True, return_tensors="pt"
    ).to(device)
    outputs = model.generate(
        **inputs,
        max_new_tokens=120,
        do_sample=False,
        repetition_penalty=1.08,
        eos_token_id=tokenizer.eos_token_id,
        pad_token_id=tokenizer.pad_token_id or tokenizer.eos_token_id,
    )
    answer = tokenizer.decode(outputs[0][inputs["input_ids"].shape[-1]:], skip_special_tokens=True).strip()
    # Drop an accidentally generated follow-up sentence while retaining the direct answer.
    sentences = re.split(r"(?<=[.!?])\s+", answer)
    answer = " ".join(sentence for sentence in sentences if sentence and "?" not in sentence).strip()
    if not answer:
        raise HTTPException(status_code=502, detail="The model did not return a direct answer.")
    return {"reply": answer[:2400]}
