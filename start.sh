#!/bin/sh
export POSTGRES_USER=mevowner
export POSTGRES_PASSWORD=SRTrDKSqeH
export POSTGRES_HOST=3.214.251.137
export REDIS_USER=
export REDIS_HOST=localhost
export REDIS_PASSWORD=
export RPC_URL="https://polygon-mainnet.core.chainstack.com/3769b2310dd64cd148230337360ed1d8"

#/root/.pyenv/shims/poetry run alembic upgrade head
/root/.pyenv/shims/poetry run python3 listener.py
