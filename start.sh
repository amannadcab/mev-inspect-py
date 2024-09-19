#!/bin/sh
export POSTGRES_USER=mevowner
export POSTGRES_PASSWORD=SRTrDKSqeH
export POSTGRES_HOST=64.227.129.194
export REDIS_USER=
export REDIS_HOST=localhost
export REDIS_PASSWORD=
export RPC_URL="https://bsc-mainnet.core.chainstack.com/d776f7b6688b8591c679ff606d94f239"

#/root/.pyenv/shims/poetry run alembic upgrade head
/root/.pyenv/shims/poetry run python3 listener.py
