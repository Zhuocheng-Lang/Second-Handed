from __future__ import annotations

from server.interfaces.http.routers import trade as trade_api


def test_get_trade_list(client, monkeypatch):
    monkeypatch.setattr(
        trade_api.trade_service,
        "list_trade_records",
        lambda limit=50: [
            {
                "trade_id": "t1",
                "seller_pubkey": "seller",
                "buyer_pubkey": None,
                "status": "OPEN",
                "description": "book",
                "price": 10,
                "content_hash": "hash",
                "created_at": None,
            }
        ],
    )

    response = client.get("/trade/list")
    assert response.status_code == 200
    payload = response.json()
    assert payload["data"][0]["trade_id"] == "t1"


def test_get_trade_not_found(client, monkeypatch):
    monkeypatch.setattr(trade_api.trade_service, "get_trade_record", lambda _: None)

    response = client.get("/trade/missing")
    assert response.status_code == 404


def test_create_trade_happy_path(client, monkeypatch):
    created = {}

    def fake_verify_create(**kwargs):
        created.update(kwargs)
        return {
            "type": "CREATE",
            "trade_id": kwargs["trade_id"],
            "payload": {
                "content_hash": kwargs["content_hash"],
                "seller_pubkey": kwargs["seller_pubkey"],
                "description": kwargs.get("description"),
                "price": kwargs.get("price"),
            },
            "signatures": {"seller": kwargs["signature"]},
        }

    def fake_apply_block(block):
        created["applied"] = block

    monkeypatch.setattr(trade_api, "verify_create", fake_verify_create)
    monkeypatch.setattr(trade_api, "apply_block", fake_apply_block)

    response = client.post(
        "/trade/create",
        json={
            "trade_id": "t1",
            "content_hash": "hash",
            "seller_pubkey": "seller",
            "signature": "sig",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert created["applied"]["trade_id"] == "t1"
