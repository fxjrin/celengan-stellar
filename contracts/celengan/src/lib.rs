#![no_std]

use soroban_sdk::{
    contract, contractevent, contracterror, contractimpl, contracttype, token, Address, Env,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
const INSTANCE_BUMP_AMOUNT: u32 = DAY_IN_LEDGERS * 90;
const BALANCE_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
const BALANCE_BUMP_AMOUNT: u32 = DAY_IN_LEDGERS * 90;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    InvalidAmount = 1,
    InsufficientBalance = 2,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Token,
    Balance(Address),
}

#[contractevent]
#[derive(Clone)]
pub struct Deposit {
    #[topic]
    pub user: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone)]
pub struct Withdraw {
    #[topic]
    pub user: Address,
    pub amount: i128,
}

#[contract]
pub struct Celengan;

#[contractimpl]
impl Celengan {
    // Sets the token this piggy bank holds (the XLM Stellar Asset Contract on
    // testnet). Runs once at deploy.
    pub fn __constructor(e: Env, token: Address) {
        e.storage().instance().set(&DataKey::Token, &token);
    }

    // Moves `amount` of the token from `from` into their savings and returns the
    // new saved balance. Requires the depositor's authorization.
    pub fn deposit(e: Env, from: Address, amount: i128) -> Result<i128, Error> {
        from.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let token = token_address(&e);
        token::Client::new(&e, &token).transfer(&from, &e.current_contract_address(), &amount);

        let updated = balance_of(&e, &from) + amount;
        set_balance(&e, &from, updated);
        Deposit { user: from, amount }.publish(&e);
        bump_instance(&e);
        Ok(updated)
    }

    // Returns `amount` of the token from savings back to `to` and returns the new
    // saved balance. Requires the owner's authorization.
    pub fn withdraw(e: Env, to: Address, amount: i128) -> Result<i128, Error> {
        to.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let current = balance_of(&e, &to);
        if amount > current {
            return Err(Error::InsufficientBalance);
        }

        let updated = current - amount;
        set_balance(&e, &to, updated);

        let token = token_address(&e);
        token::Client::new(&e, &token).transfer(&e.current_contract_address(), &to, &amount);
        Withdraw { user: to, amount }.publish(&e);
        bump_instance(&e);
        Ok(updated)
    }

    // Returns the saved balance of `user`, or 0 if they have never deposited.
    pub fn balance(e: Env, user: Address) -> i128 {
        balance_of(&e, &user)
    }

    // Returns the token address this contract holds.
    pub fn token(e: Env) -> Address {
        token_address(&e)
    }
}

fn token_address(e: &Env) -> Address {
    e.storage().instance().get(&DataKey::Token).unwrap()
}

fn balance_of(e: &Env, user: &Address) -> i128 {
    let key = DataKey::Balance(user.clone());
    let value: i128 = e.storage().persistent().get(&key).unwrap_or(0);
    if value != 0 {
        e.storage()
            .persistent()
            .extend_ttl(&key, BALANCE_BUMP_THRESHOLD, BALANCE_BUMP_AMOUNT);
    }
    value
}

fn set_balance(e: &Env, user: &Address, amount: i128) {
    let key = DataKey::Balance(user.clone());
    e.storage().persistent().set(&key, &amount);
    e.storage()
        .persistent()
        .extend_ttl(&key, BALANCE_BUMP_THRESHOLD, BALANCE_BUMP_AMOUNT);
}

fn bump_instance(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

#[cfg(test)]
mod test;
