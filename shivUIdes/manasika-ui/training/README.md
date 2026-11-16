# Fine-tune the AI Companion with LoRA

This folder provides a real supervised fine-tuning path for an open-weight model. It downloads HuggingFaceTB/SmolLM2-135M-Instruct (Apache-2.0) on the first training run, keeps the 269 MB base checkpoint in the Hugging Face cache, trains a small PEFT LoRA adapter, and leaves both weight sets outside Git. This compact model is selected for CPU fine-tuning on this workstation; choose a larger base with `--base-model` when more RAM or a GPU is available. The current Manasika backend remains usable without this optional model service.

## Prepare a private training environment

Use Python 3.11–3.14. The runtime does not need to use the same Python environment as the Vite app.

```powershell
cd "shivUIdes/manasika-ui"
py -3.12 -m venv .venv-model
.\.venv-model\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r training/requirements.txt
```

Install the PyTorch build that matches the local CUDA driver if the machine has a supported NVIDIA GPU. CPU training is supported but can be very slow. The base checkpoint is about 269 MB; allow additional disk space for the Hugging Face cache, training checkpoints, and adapter. The adapter is written under the ignored `training/output/` directory.

## Prepare data and train

```powershell
python training/prepare_companion_data.py
python training/train_companion_lora.py --epochs 1
```

The repository includes a **pilot adapter** in `training/weights/companion-smollm2-135m-lora-pilot/`. It was trained for one epoch on a seeded, randomly selected 128-example subset of the 1,310 prepared examples, with 32 optimizer steps on CPU. The training loss was 3.26. This confirms that the fine-tuning pipeline updates LoRA weights, but this small pilot is not a quality benchmark or production-ready model. Re-run the command above to train on the full prepared set; use a GPU and evaluate on held-out prompts before production use. The generated full adapter is saved under ignored `training/output/`.

The preparation step reads the existing base and augmented mental-health support datasets and the public-domain literature corpus. It excludes crisis instructions, diagnosis/medication examples, unsafe completions, duplicate pairs, private account conversations, and the locally supplied copyrighted psychology textbook. That textbook remains available only in the ignored local SQLite retrieval database and is not used for training or uploaded.

The resulting JSONL, manifest, model checkpoints, and adapter are all Git-ignored. Training data from user-supplied datasets should only be used if their license and privacy terms permit it. Do not publish the adapter without checking all source-data rights.

## Run and connect the trained adapter

To try the included pilot (or another locally trained adapter), keep the virtual environment active and run the local inference service:

```powershell
$env:COMPANION_ADAPTER_PATH = "training/weights/companion-smollm2-135m-lora-pilot"
python -m uvicorn training.companion_model_service:app --host 127.0.0.1 --port 8090
```

Set `COMPANION_MODEL_API_URL=http://127.0.0.1:8090/generate` in the Node backend's `.env` and restart it. The backend keeps its pre-response crisis and medical-safety boundaries, supplies a retrieved database answer as context, and uses the LoRA model to compose a reply. The pilot can produce generic or awkward phrasing, so the model service is opt-in; review its answers before enabling it for users. If the model service is stopped or fails, the backend falls back to the existing database retrieval response. The inference service binds to loopback by default and receives the message plus retrieved context from the local backend; do not expose it publicly without authentication, TLS, rate limits, and privacy review.

This trains adapter weights over a frozen base model; it does not rewrite the 1.5 GB base checkpoint. New source datasets require re-preparing and re-running training to affect the adapter. Database retrieval remains active, so new indexed records can be used without retraining.
