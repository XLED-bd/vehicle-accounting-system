# Transformer on PyTorch

[English version](README.en.md)

Реализация архитектуры Transformer с нуля на PyTorch и её применение к трём задачам NLP:

1. **Бинарная классификация** — анализ тональности отзывов IMDB (positive / negative).
2. **Многоклассовая классификация** — тематика новостей AG News (4 класса).
3. **Машинный перевод** — English → Spanish и English → Russian (seq2seq, encoder–decoder).

Все эксперименты собраны в ноутбуке [transformer.ipynb](transformer.ipynb).

## Структура проекта

| Файл | Содержимое |
|---|---|
| [positional_embedding.py](positional_embedding.py) | `PositionalEmbedding` — сумма обучаемых эмбеддингов токенов и позиций |
| [transformer_encoder.py](transformer_encoder.py) | `TransformerEncoder` — блок энкодера: Multi-Head Attention → Add & Norm → FFN → Add & Norm |
| `transformer_decoder.py` | `TransformerDecoder` — блок декодера (используется в ноутбуке, **в репозитории пока отсутствует**) |
| [dataset.py](dataset.py) | Датасеты `IMDBDataset`, `AGDataset`, `TranslateDataset`: токенизация, построение словаря, паддинг |
| [utils.py](utils.py) | Фабрики `DataLoader`: `create_imdb_dataloader`, `create_ag_dataloader`, `create_translate_dataloader` |
| [transformer.ipynb](transformer.ipynb) | Модели, обучение и оценка для всех задач |

## Архитектура

**Энкодер** ([transformer_encoder.py](transformer_encoder.py)):

```
x ─► MultiheadAttention(x, x, x) ─► + x ─► LayerNorm ─► Linear → ReLU → Linear ─► + ─► LayerNorm ─► out
```

**Модели в ноутбуке:**

- *Классификатор* — `PositionalEmbedding → TransformerEncoder → max-pooling по последовательности → Linear`
  (для IMDB — выход 1 нейрон + `Sigmoid` + `BCELoss`, для AG News — 4 логита + `CrossEntropyLoss`).
- *Переводчик* — отдельные `PositionalEmbedding` для исходного и целевого языка,
  `TransformerEncoder` + `TransformerDecoder`, `Dropout(0.5)` и `Linear` на размер словаря.
  Обучение с teacher forcing (вход декодера начинается с `<start>`, цель заканчивается `<end>`),
  инференс — жадное декодирование токен за токеном (функция `predict`).

## Установка

Нужен Python 3.10 и GPU с CUDA (см. «Известные ограничения»).

```bash
pip install torch torchtext==0.18 pandas spacy jupyter
# токенизаторы для перевода EN → RU
python -m spacy download en_core_web_sm
python -m spacy download ru_core_news_sm
```

> `torchtext` объявлен устаревшим, 0.18 — последняя версия. Она должна соответствовать вашей версии `torch` (для torchtext 0.18 — torch 2.3).

## Данные

| Задача | Источник | Куда положить |
|---|---|---|
| IMDB | `curl -O https://ai.stanford.edu/~amaas/data/sentiment/aclImdb_v1.tar.gz && tar -xf aclImdb_v1.tar.gz` | `aclImdb/train`, `aclImdb/test` |
| AG News | [Kaggle: AG News Classification Dataset](https://www.kaggle.com/datasets/amananandrai/ag-news-classification-dataset) (CSV с колонками `Class Index`, `Title`, `Description`) | `ag_news/train.csv`, `ag_news/test.csv` |
| EN → ES | `wget http://storage.googleapis.com/download.tensorflow.org/data/spa-eng.zip && unzip spa-eng.zip` | `spa-eng/spa.txt` |
| EN → RU | [manythings.org/anki](https://www.manythings.org/anki/) — архив `rus-eng.zip` | `eng-rus/rus.txt` |

Файлы для перевода — это пары предложений, разделённые табуляцией (`english\tперевод\t...`).

## Использование

```bash
jupyter notebook transformer.ipynb
```

Каждый раздел ноутбука независим: загрузка данных → определение модели → обучение → оценка/примеры.

Пример использования модулей напрямую:

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

## Гиперпараметры и результаты

| Задача | embed_dim | heads | dense_dim | Словарь | Оптимизатор | Результат |
|---|---|---|---|---|---|---|
| IMDB | 128 | 2 | 32 | 20 000 | AdamW, lr 1e-4 | train acc ≈ 66 % после 2 эпох |
| AG News | 128 | 4 | 32 | 30 000 | RMSprop, lr 1e-4 | train acc ≈ 81 % после 1 эпохи |
| EN → ES | 256 | 8 | 2048 | 15 000 | RMSprop, lr 5e-4 | train loss ≈ 0.91 после 16 эпох |
| EN → RU | 256 | 8 | 2048 | 15 000 | RMSprop, lr 5e-4 | train loss ≈ 0.84 после 18 эпох |

Пример перевода EN → RU из ноутбука:

```
care of about us  →  <start> заботиться о нас <end>
```

## Известные ограничения

- **Нет `transformer_decoder.py`** — ноутбук импортирует `TransformerDecoder`, но файла в репозитории нет, поэтому разделы перевода не запустятся без него.
- **Нет `create_eng_spa_dataloader`** в [utils.py](utils.py) — раздел EN → ES использует старое имя функции; актуальная — `create_translate_dataloader` с явными токенизаторами.
- **Только GPU** — в [positional_embedding.py](positional_embedding.py) позиции создаются через `.cuda()`, на CPU модель упадёт.
- Таблица позиционных эмбеддингов имеет размер словаря (`input_dim`), а не максимальной длины последовательности — работает, но расходует лишнюю память.
- Маска паддинга и causal-маска для декодера не передаются, поэтому модель может «подглядывать» за будущими токенами и учитывать `<pad>`.
- Оценка на тестовых выборках (IMDB ≈ 52 %, AG News ≈ 25 %) близка к случайной: тестовый датасет строит **собственный словарь** вместо словаря из обучающей выборки. Нужно передавать `vocab=train_dataset.vocab` при создании тестового датасета.
