import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions } from "@stellar/stellar-sdk/contract";
import type { u32, u64, i128, Option } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CAFTAGQPSJIO5VSDFL6LS5NL4UDS7OQ2D22US4QTVHJJW6Y7YLWCPZ33";
    };
};
export declare const Errors: {
    1: {
        message: string;
    };
    2: {
        message: string;
    };
    3: {
        message: string;
    };
    4: {
        message: string;
    };
    5: {
        message: string;
    };
    6: {
        message: string;
    };
    7: {
        message: string;
    };
    8: {
        message: string;
    };
    9: {
        message: string;
    };
};
export interface Account {
    lock_until: u64;
    shares: i128;
    spend: i128;
    split_bps: u32;
    yield_target: YieldTarget;
}
export type YieldTarget = {
    tag: "Defindex";
    values: void;
} | {
    tag: "Blend";
    values: void;
} | {
    tag: "Soroswap";
    values: void;
};
export declare const OwnableError: {
    2100: {
        message: string;
    };
    2101: {
        message: string;
    };
    2102: {
        message: string;
    };
};
export declare const PausableError: {
    /**
     * The operation failed because the contract is paused.
     */
    1000: {
        message: string;
    };
    /**
     * The operation failed because the contract is not paused.
     */
    1001: {
        message: string;
    };
};
export interface Client {
    /**
     * Construct and simulate a pay transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Pays `to` through the splitter: the savings share of `amount` goes to
     * `to`'s chosen yield source, the rest is credited to the spendable balance.
     */
    pay: ({ from, to, amount }: {
        from: string;
        to: string;
        amount: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a usdc transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    usdc: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;
    /**
     * Construct and simulate a owner transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    owner: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>;
    /**
     * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    pause: (options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a vault transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    vault: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;
    /**
     * Construct and simulate a paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    paused: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>;
    /**
     * Construct and simulate a unpause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    unpause: (options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a set_lock transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Locks savings withdrawals until `until`; a lock can only be extended.
     */
    set_lock: ({ user, until }: {
        user: string;
        until: u64;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a set_split transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_split: ({ user, bps }: {
        user: string;
        bps: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a account_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    account_of: ({ user }: {
        user: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Account>>;
    /**
     * Construct and simulate a blend_pool transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    blend_pool: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;
    /**
     * Construct and simulate a soroswap_pair transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    soroswap_pair: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;
    /**
     * Construct and simulate a withdraw_spend transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    withdraw_spend: ({ user, amount }: {
        user: string;
        amount: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a set_yield_target transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Switches which protocol `user`'s future savings earn yield in. Only
     * allowed at a zero balance, since the sources' shares are not
     * interchangeable and withdrawing first keeps the accounting simple.
     */
    set_yield_target: ({ user, target }: {
        user: string;
        target: YieldTarget;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a withdraw_savings transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Redeems savings shares from `user`'s yield source and sends the
     * resulting USDC to them.
     */
    withdraw_savings: ({ user, shares }: {
        user: string;
        shares: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { owner, usdc, vault, blend_pool, soroswap_router, soroswap_factory, soroswap_pair, xlm }: {
        owner: string;
        usdc: string;
        vault: string;
        blend_pool: string;
        soroswap_router: string;
        soroswap_factory: string;
        soroswap_pair: string;
        xlm: string;
    }, 
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        pay: (json: string) => AssembledTransaction<null>;
        usdc: (json: string) => AssembledTransaction<string>;
        owner: (json: string) => AssembledTransaction<Option<string>>;
        pause: (json: string) => AssembledTransaction<null>;
        vault: (json: string) => AssembledTransaction<string>;
        paused: (json: string) => AssembledTransaction<boolean>;
        unpause: (json: string) => AssembledTransaction<null>;
        set_lock: (json: string) => AssembledTransaction<null>;
        set_split: (json: string) => AssembledTransaction<null>;
        account_of: (json: string) => AssembledTransaction<Account>;
        blend_pool: (json: string) => AssembledTransaction<string>;
        soroswap_pair: (json: string) => AssembledTransaction<string>;
        withdraw_spend: (json: string) => AssembledTransaction<null>;
        set_yield_target: (json: string) => AssembledTransaction<null>;
        withdraw_savings: (json: string) => AssembledTransaction<bigint>;
    };
}
