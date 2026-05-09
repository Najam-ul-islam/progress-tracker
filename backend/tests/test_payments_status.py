"""US4: PATCH /payments/{id}/status — admin marks paid; manager/dev denied."""

from __future__ import annotations

from tests._payments_helpers import seed_payment_for_project
from tests._projects_helpers import (
    seed_active_client,
    seed_active_project,
    seed_module,
)


def _seed_payment_with_three_children(
    session, client, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    client_row = seed_active_client(session)
    proj = seed_active_project(session, client_id=client_row.id)
    devs = [
        seed_developer(name=f"D{i}", email=f"d{i}@example.com")
        for i in range(3)
    ]
    for i, share in enumerate(["30.00", "25.00", "15.00"]):
        seed_module(
            session,
            project_id=proj.id,
            developer_id=devs[i].id,
            share=share,
            name=f"m{i}",
        )
    payment = seed_payment_for_project(
        client,
        project_id=proj.id,
        total_amount="1000.00",
        auth_header=auth_header(admin),
    )
    return admin, payment


def _seed_two_child_payment(
    session, client, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    client_row = seed_active_client(session)
    proj = seed_active_project(session, client_id=client_row.id)
    a = seed_developer(name="A", email="a@example.com")
    b = seed_developer(name="B", email="b@example.com")
    seed_module(session, project_id=proj.id, developer_id=a.id, share="40.00", name="m1")
    seed_module(session, project_id=proj.id, developer_id=b.id, share="30.00", name="m2")
    payment = seed_payment_for_project(
        client,
        project_id=proj.id,
        total_amount="1000.00",
        auth_header=auth_header(admin),
    )
    return admin, payment


def test_admin_marks_one_child_paid_parent_partial(
    client, session, seed_admin, seed_developer, auth_header
):
    admin, payment = _seed_payment_with_three_children(
        session, client, seed_admin, seed_developer, auth_header
    )
    child_id = payment["developer_breakdown"][0]["id"]
    response = client.patch(
        f"/payments/{payment['id']}/status",
        json={"developer_payment_id": child_id},
        headers=auth_header(admin),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "partial"
    paid = [c for c in body["developer_breakdown"] if c["status"] == "paid"]
    assert len(paid) == 1


def test_admin_marks_all_children_one_by_one_parent_paid(
    client, session, seed_admin, seed_developer, auth_header
):
    admin, payment = _seed_payment_with_three_children(
        session, client, seed_admin, seed_developer, auth_header
    )
    h = auth_header(admin)
    last_status = None
    for c in payment["developer_breakdown"]:
        response = client.patch(
            f"/payments/{payment['id']}/status",
            json={"developer_payment_id": c["id"]},
            headers=h,
        )
        assert response.status_code == 200
        last_status = response.json()["status"]
    assert last_status == "paid"


def test_admin_target_all_marks_parent_paid(
    client, session, seed_admin, seed_developer, auth_header
):
    admin, payment = _seed_two_child_payment(
        session, client, seed_admin, seed_developer, auth_header
    )
    response = client.patch(
        f"/payments/{payment['id']}/status",
        json={"target": "all"},
        headers=auth_header(admin),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "paid"
    assert all(c["status"] == "paid" for c in body["developer_breakdown"])


def test_idempotent_target_all_on_already_paid(
    client, session, seed_admin, seed_developer, auth_header
):
    admin, payment = _seed_two_child_payment(
        session, client, seed_admin, seed_developer, auth_header
    )
    h = auth_header(admin)
    client.patch(
        f"/payments/{payment['id']}/status", json={"target": "all"}, headers=h
    )
    response = client.patch(
        f"/payments/{payment['id']}/status", json={"target": "all"}, headers=h
    )
    assert response.status_code == 200
    assert response.json()["status"] == "paid"


def test_developer_payment_id_from_other_payment_returns_422(
    client, session, seed_admin, seed_developer, auth_header
):
    admin, p1 = _seed_two_child_payment(
        session, client, seed_admin, seed_developer, auth_header
    )
    # Generate a second Payment on a different project (reuse existing client).
    from app.modules.clients.repository import list_clients

    existing_client = list_clients(session)[0]
    proj2 = seed_active_project(
        session, client_id=existing_client.id, name="P2"
    )
    dev = seed_developer(name="X", email="x2@example.com")
    seed_module(session, project_id=proj2.id, developer_id=dev.id, share="70.00")
    p2 = seed_payment_for_project(
        client,
        project_id=proj2.id,
        total_amount="500.00",
        auth_header=auth_header(admin),
    )
    foreign_child_id = p2["developer_breakdown"][0]["id"]
    response = client.patch(
        f"/payments/{p1['id']}/status",
        json={"developer_payment_id": foreign_child_id},
        headers=auth_header(admin),
    )
    assert response.status_code == 422
    assert "does not belong" in response.json()["detail"]


def test_empty_body_returns_422(
    client, session, seed_admin, seed_developer, auth_header
):
    admin, payment = _seed_two_child_payment(
        session, client, seed_admin, seed_developer, auth_header
    )
    response = client.patch(
        f"/payments/{payment['id']}/status",
        json={},
        headers=auth_header(admin),
    )
    assert response.status_code == 422


def test_both_fields_supplied_returns_422(
    client, session, seed_admin, seed_developer, auth_header
):
    admin, payment = _seed_two_child_payment(
        session, client, seed_admin, seed_developer, auth_header
    )
    child_id = payment["developer_breakdown"][0]["id"]
    response = client.patch(
        f"/payments/{payment['id']}/status",
        json={"developer_payment_id": child_id, "target": "all"},
        headers=auth_header(admin),
    )
    assert response.status_code == 422


def test_unknown_field_returns_422(
    client, session, seed_admin, seed_developer, auth_header
):
    admin, payment = _seed_two_child_payment(
        session, client, seed_admin, seed_developer, auth_header
    )
    response = client.patch(
        f"/payments/{payment['id']}/status",
        json={"target": "all", "extra": 1},
        headers=auth_header(admin),
    )
    assert response.status_code == 422


def test_manager_cannot_patch_status(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    _, payment = _seed_two_child_payment(
        session, client, seed_admin, seed_developer, auth_header
    )
    manager = seed_manager()
    response = client.patch(
        f"/payments/{payment['id']}/status",
        json={"target": "all"},
        headers=auth_header(manager),
    )
    assert response.status_code == 403


def test_developer_cannot_patch_status(
    client, session, seed_admin, seed_developer, auth_header
):
    _, payment = _seed_two_child_payment(
        session, client, seed_admin, seed_developer, auth_header
    )
    dev = seed_developer(name="D", email="d@example.com")
    response = client.patch(
        f"/payments/{payment['id']}/status",
        json={"target": "all"},
        headers=auth_header(dev),
    )
    assert response.status_code == 403


def test_missing_payment_id_returns_404(
    client, session, seed_admin, auth_header
):
    admin = seed_admin()
    response = client.patch(
        "/payments/9999/status",
        json={"target": "all"},
        headers=auth_header(admin),
    )
    assert response.status_code == 404


def test_unauth_patch_returns_401(client):
    response = client.patch("/payments/1/status", json={"target": "all"})
    assert response.status_code == 401
