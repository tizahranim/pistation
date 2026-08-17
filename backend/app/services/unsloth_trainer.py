import os
import sys
import json
import time
import asyncio
import subprocess
from typing import List, Dict, Any, Callable, Optional

UNSLOTH_MODEL_MAPPINGS = {
    "qwen": "unsloth/Qwen2.5-7B-Instruct-bnb-4bit",
    "qwen2.5": "unsloth/Qwen2.5-7B-Instruct-bnb-4bit",
    "qwen3": "unsloth/Qwen2.5-7B-Instruct-bnb-4bit",
    "gemma": "unsloth/gemma-2-9b-it-bnb-4bit",
    "gemma2": "unsloth/gemma-2-9b-it-bnb-4bit",
    "gemma4": "unsloth/gemma-2-9b-it-bnb-4bit",
    "llama": "unsloth/Meta-Llama-3.1-8B-Instruct-bnb-4bit",
    "llama3": "unsloth/Meta-Llama-3.1-8B-Instruct-bnb-4bit",
    "llama3.2": "unsloth/Llama-3.2-3B-Instruct-bnb-4bit",
    "mistral": "unsloth/mistral-7b-instruct-v0.3-bnb-4bit",
    "phi": "unsloth/Phi-3.5-mini-instruct-bnb-4bit"
}

def resolve_unsloth_model(base_name: str) -> str:
    lower = (base_name or "").lower()
    for k, v in UNSLOTH_MODEL_MAPPINGS.items():
        if k in lower:
            return v
    return "unsloth/Qwen2.5-7B-Instruct-bnb-4bit"

ALPACA_TEMPLATE = """Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
{instruction}

### Input:
{input}

### Response:
{output}"""
