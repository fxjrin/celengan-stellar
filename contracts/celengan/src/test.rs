use super::{Celengan, CelenganClient, Error};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env};

fn setup() -> (
    Env,
    CelenganClient<'static>,
    token::StellarAssetClient<'static>,
    token::Client<'static>,
) {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(admin);
    let token_id = sac.address();
    let token_admin = token::StellarAssetClient::new(&e, &token_id);
    let token_client = token::Client::new(&e, &token_id);

    let contract_id = e.register(Celengan, (token_id.clone(),));
    let client = CelenganClient::new(&e, &contract_id);

    (e, client, token_admin, token_client)
}

#[test]
fn deposit_then_withdraw_updates_balances() {
    let (e, client, token_admin, token) = setup();
    let user = Address::generate(&e);
    token_admin.mint(&user, &1_000);

    assert_eq!(client.balance(&user), 0);

    client.deposit(&user, &600);
    assert_eq!(client.balance(&user), 600);
    assert_eq!(token.balance(&user), 400);
    assert_eq!(token.balance(&client.address), 600);

    client.withdraw(&user, &250);
    assert_eq!(client.balance(&user), 350);
    assert_eq!(token.balance(&user), 650);
}

#[test]
fn withdraw_more_than_balance_fails() {
    let (e, client, token_admin, _token) = setup();
    let user = Address::generate(&e);
    token_admin.mint(&user, &100);
    client.deposit(&user, &100);

    assert_eq!(
        client.try_withdraw(&user, &200),
        Err(Ok(Error::InsufficientBalance))
    );
}

#[test]
fn deposit_zero_fails() {
    let (e, client, token_admin, _token) = setup();
    let user = Address::generate(&e);
    token_admin.mint(&user, &100);

    assert_eq!(
        client.try_deposit(&user, &0),
        Err(Ok(Error::InvalidAmount))
    );
}
