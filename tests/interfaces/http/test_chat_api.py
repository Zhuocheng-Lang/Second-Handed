from __future__ import annotations

from server.interfaces.http.routers import chat as chat_api


def test_chat_history(client, monkeypatch):
    monkeypatch.setattr(
        chat_api.chat_service,
        "get_chat_history",
        lambda trade_id, limit=100: [
            {
                "id": 1,
                "trade_id": trade_id,
                "ciphertext": "cipher",
                "timestamp": 1700000000,
                "buyer_chat_pubkey": "buyer",
                "sender_pubkey": "sender",
            }
        ],
    )

    response = client.get("/chat/history/t1")
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["messages"][0]["trade_id"] == "t1"


def test_chat_room_info(client, monkeypatch):
    async def fake_room_info(trade_id: str):
        return [
            {
                "identity_pubkey": "user",
                "chat_pubkey": "chat",
                "connected": True,
            }
        ]

    monkeypatch.setattr(chat_api.chat_service, "get_room_info", fake_room_info)

    response = client.get("/chat/room/t1")
    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
