# Transformer on PyTorch

[Русская версия](README.md)

A from-scratch Transformer implementation in PyTorch, applied to three NLP tasks:

1. **Binary classification** — IMDB movie review sentiment (positive / negative).
2. **Multi-class classification** — AG News topic classification (4 classes).
3. **Machine translation** — English → Spanish and English → Russian (seq2seq, encoder–decoder).

All experiments live in the [transformer.ipynb](transformer.ipynb) notebook.

## Project structure

| File | Contents |
|---|---|
| [positional_embedding.py](positional_embedding.py) | `PositionalEmbedding` — sum of learned token and position embeddings |
| [transformer_encoder.py](transformer_encoder.py) | `TransformerEncoder` — encoder block: Multi-Head Attention → Add & Norm → FFN → Add & Norm |
| `transformer_decoder.py` | `TransformerDecoder` — decoder block (imported by the notebook, **not yet in the repository**) |
| [dataset.py](dataset.py) | `IMDBDataset`, `AGDataset`, `TranslateDataset`: tokenization, vocabulary building, padding |
| [utils.py](utils.py) | `DataLoader` factories: `create_imdb_dataloader`, `create_ag_dataloader`, `create_translate_dataloader` |
| [transformer.ipynb](transformer.ipynb) | Models, training and evaluation for all tasks |

## Architecture

**Encoder** ([transformer_encoder.py](transformer_encoder.py)):

```
x ─► MultiheadAttention(x, x, x) ─► + x ─► LayerNorm ─► Linear → ReLU → Linear ─► + ─► LayerNorm ─► out
```

**Models in the notebook:**

- *Classifier* — `PositionalEmbedding → TransformerEncoder → max-pooling over the sequence → Linear`
  (IMDB: a single output + `Sigmoid` + `BCELoss`; AG News: 4 logits + `CrossEntropyLoss`).
- *Translator* — separate `PositionalEmbedding`s for the source and target languages,
  `TransformerEncoder` + `TransformerDecoder`, `Dropout(0.5)` and a `Linear` layer over the vocabulary.
  Trained with teacher forcing (decoder input starts with `<start>`, target ends with `<end>`);
  inference uses greedy token-by-token decoding (the `predict` function).

## Installation

Requires Python 3.10 and a CUDA GPU (see "Known limitations").

```bash
pip install torch torchtext==0.18 pandas spacy jupyter
# tokenizers for EN → RU translation
python -m spacy download en_core_web_sm
python -m spacy download ru_core_news_sm
```

> `torchtext` is deprecated and 0.18 is its final release. It must match your `torch` version (torchtext 0.18 pairs with torch 2.3).

## Data

| Task | Source | Location |
|---|---|---|
| IMDB | `curl -O https://ai.stanford.edu/~amaas/data/sentiment/aclImdb_v1.tar.gz && tar -xf aclImdb_v1.tar.gz` | `aclImdb/train`, `aclImdb/test` |
| AG News | [Kaggle: AG News Classification Dataset](https://www.kaggle.com/datasets/amananandrai/ag-news-classification-dataset) (CSV with `Class Index`, `Title`, `Description` columns) | `ag_news/train.csv`, `ag_news/test.csv` |
| EN → ES | `wget http://storage.googleapis.com/download.tensorflow.org/data/spa-eng.zip && unzip spa-eng.zip` | `spa-eng/spa.txt` |
| EN → RU | [manythings.org/anki](https://www.manythings.org/anki/) — `rus-eng.zip` archive | `eng-rus/rus.txt` |

Translation files are tab-separated sentence pairs (`english\ttranslation\t...`).

## Usage

```bash
jupyter notebook transformer.ipynb
```

Each notebook section is self-contained: load data → define model → train → evaluate / show examples.

Using the modules directly:

```python
from utils import create_imdb_dataloader
from positional_embedding import PositionalEmbedding
from transformer_encoder import TransformerEncoder

train_dl, vocab = create_imdb_dataloader("aclImdb/train", batch_size=32)

emb = PositionalEmbedding(input_dim=20000, output_dim=128).cuda()
enc = TransformerEncoder(embed_dim=128, dense_dim=32, num_heads=2).cuda()

text, label = next(iter(train_dl))
hidden = enc(emb(text.cuda()))   # (batch, 600, 128)
```

## Hyperparameters and results

| Task | embed_dim | heads | dense_dim | Vocab | Optimizer | Result |
|---|---|---|---|---|---|---|
| IMDB | 128 | 2 | 32 | 20,000 | AdamW, lr 1e-4 | train acc ≈ 66% after 2 epochs |
| AG News | 128 | 4 | 32 | 30,000 | RMSprop, lr 1e-4 | train acc ≈ 81% after 1 epoch |
| EN → ES | 256 | 8 | 2048 | 15,000 | RMSprop, lr 5e-4 | train loss ≈ 0.91 after 16 epochs |
| EN → RU | 256 | 8 | 2048 | 15,000 | RMSprop, lr 5e-4 | train loss ≈ 0.84 after 18 epochs |

EN → RU translation example from the notebook:

```
care of about us  →  <start> заботиться о нас <end>
```

## Known limitations

- **`transformer_decoder.py` is missing** — the notebook imports `TransformerDecoder`, but the file is not in the repository, so the translation sections won't run without it.
- **`create_eng_spa_dataloader` is missing** from [utils.py](utils.py) — the EN → ES section uses an old function name; the current one is `create_translate_dataloader` with explicit tokenizers.
- **GPU only** — [positional_embedding.py](positional_embedding.py) creates positions with `.cuda()`, so the model fails on CPU.
- The position embedding table is sized by the vocabulary (`input_dim`) rather than the maximum sequence length — it works, but wastes memory.
- No padding mask or causal decoder mask is passed, so the model may attend to future tokens and to `<pad>`.
- Test accuracy (IMDB ≈ 52%, AG News ≈ 25%) is close to chance because the test dataset builds **its own vocabulary** instead of reusing the training one. Pass `vocab=train_dataset.vocab` when creating the test dataset.
