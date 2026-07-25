import { Buffer } from "buffer";
import { Client as ContractClient, Spec as ContractSpec, } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
if (typeof window !== "undefined") {
    //@ts-ignore Buffer exists
    window.Buffer = window.Buffer || Buffer;
}
export const networks = {
    testnet: {
        networkPassphrase: "Test SDF Network ; September 2015",
        contractId: "CAFTAGQPSJIO5VSDFL6LS5NL4UDS7OQ2D22US4QTVHJJW6Y7YLWCPZ33",
    }
};
export const Errors = {
    1: { message: "InvalidAmount" },
    2: { message: "InvalidSplit" },
    3: { message: "InsufficientSpend" },
    4: { message: "InsufficientShares" },
    5: { message: "SavingsLocked" },
    6: { message: "LockNotExtended" },
    7: { message: "EmptyWithdrawal" },
    8: { message: "LockTooLong" },
    9: { message: "SwitchTargetWithBalance" }
};
export const OwnableError = {
    2100: { message: "OwnerNotSet" },
    2101: { message: "TransferInProgress" },
    2102: { message: "OwnerAlreadySet" }
};
export const PausableError = {
    /**
     * The operation failed because the contract is paused.
     */
    1000: { message: "EnforcedPause" },
    /**
     * The operation failed because the contract is not paused.
     */
    1001: { message: "ExpectedPause" }
};
export class Client extends ContractClient {
    options;
    static async deploy(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { owner, usdc, vault, blend_pool, soroswap_router, soroswap_factory, soroswap_pair, xlm }, 
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return ContractClient.deploy({ owner, usdc, vault, blend_pool, soroswap_router, soroswap_factory, soroswap_pair, xlm }, options);
    }
    constructor(options) {
        super(new ContractSpec(["AAAAAAAAAJBQYXlzIGB0b2AgdGhyb3VnaCB0aGUgc3BsaXR0ZXI6IHRoZSBzYXZpbmdzIHNoYXJlIG9mIGBhbW91bnRgIGdvZXMgdG8KYHRvYCdzIGNob3NlbiB5aWVsZCBzb3VyY2UsIHRoZSByZXN0IGlzIGNyZWRpdGVkIHRvIHRoZSBzcGVuZGFibGUgYmFsYW5jZS4AAAADcGF5AAAAAAMAAAAAAAAABGZyb20AAAATAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
            "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACQAAAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAAEAAAAAAAAADEludmFsaWRTcGxpdAAAAAIAAAAAAAAAEUluc3VmZmljaWVudFNwZW5kAAAAAAAAAwAAAAAAAAASSW5zdWZmaWNpZW50U2hhcmVzAAAAAAAEAAAAAAAAAA1TYXZpbmdzTG9ja2VkAAAAAAAABQAAAAAAAAAPTG9ja05vdEV4dGVuZGVkAAAAAAYAAAAAAAAAD0VtcHR5V2l0aGRyYXdhbAAAAAAHAAAAAAAAAAtMb2NrVG9vTG9uZwAAAAAIAAAAAAAAABdTd2l0Y2hUYXJnZXRXaXRoQmFsYW5jZQAAAAAJ",
            "AAAAAAAAAAAAAAAEdXNkYwAAAAAAAAABAAAAEw==",
            "AAAAAAAAAAAAAAAFb3duZXIAAAAAAAAAAAAAAQAAA+gAAAAT",
            "AAAAAAAAAAAAAAAFcGF1c2UAAAAAAAAAAAAAAA==",
            "AAAAAAAAAAAAAAAFdmF1bHQAAAAAAAAAAAAAAQAAABM=",
            "AAAAAQAAAAAAAAAAAAAAB0FjY291bnQAAAAABQAAAAAAAAAKbG9ja191bnRpbAAAAAAABgAAAAAAAAAGc2hhcmVzAAAAAAALAAAAAAAAAAVzcGVuZAAAAAAAAAsAAAAAAAAACXNwbGl0X2JwcwAAAAAAAAQAAAAAAAAADHlpZWxkX3RhcmdldAAAB9AAAAALWWllbGRUYXJnZXQA",
            "AAAAAAAAAAAAAAAGcGF1c2VkAAAAAAAAAAAAAQAAAAE=",
            "AAAAAAAAAAAAAAAHdW5wYXVzZQAAAAAAAAAAAA==",
            "AAAAAAAAAEVMb2NrcyBzYXZpbmdzIHdpdGhkcmF3YWxzIHVudGlsIGB1bnRpbGA7IGEgbG9jayBjYW4gb25seSBiZSBleHRlbmRlZC4AAAAAAAAIc2V0X2xvY2sAAAACAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAFdW50aWwAAAAAAAAGAAAAAA==",
            "AAAAAAAAAAAAAAAJc2V0X3NwbGl0AAAAAAAAAgAAAAAAAAAEdXNlcgAAABMAAAAAAAAAA2JwcwAAAAAEAAAAAA==",
            "AAAAAgAAAAAAAAAAAAAAC1lpZWxkVGFyZ2V0AAAAAAMAAAAAAAAAAAAAAAhEZWZpbmRleAAAAAAAAAAAAAAABUJsZW5kAAAAAAAAAAAAAAAAAAAIU29yb3N3YXA=",
            "AAAAAAAAAAAAAAAKYWNjb3VudF9vZgAAAAAAAQAAAAAAAAAEdXNlcgAAABMAAAABAAAH0AAAAAdBY2NvdW50AA==",
            "AAAAAAAAAAAAAAAKYmxlbmRfcG9vbAAAAAAAAAAAAAEAAAAT",
            "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAgAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAEdXNkYwAAABMAAAAAAAAABXZhdWx0AAAAAAAAEwAAAAAAAAAKYmxlbmRfcG9vbAAAAAAAEwAAAAAAAAAPc29yb3N3YXBfcm91dGVyAAAAABMAAAAAAAAAEHNvcm9zd2FwX2ZhY3RvcnkAAAATAAAAAAAAAA1zb3Jvc3dhcF9wYWlyAAAAAAAAEwAAAAAAAAADeGxtAAAAABMAAAAA",
            "AAAAAAAAAAAAAAANc29yb3N3YXBfcGFpcgAAAAAAAAAAAAABAAAAEw==",
            "AAAAAAAAAAAAAAAOd2l0aGRyYXdfc3BlbmQAAAAAAAIAAAAAAAAABHVzZXIAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
            "AAAAAAAAAMNTd2l0Y2hlcyB3aGljaCBwcm90b2NvbCBgdXNlcmAncyBmdXR1cmUgc2F2aW5ncyBlYXJuIHlpZWxkIGluLiBPbmx5CmFsbG93ZWQgYXQgYSB6ZXJvIGJhbGFuY2UsIHNpbmNlIHRoZSBzb3VyY2VzJyBzaGFyZXMgYXJlIG5vdAppbnRlcmNoYW5nZWFibGUgYW5kIHdpdGhkcmF3aW5nIGZpcnN0IGtlZXBzIHRoZSBhY2NvdW50aW5nIHNpbXBsZS4AAAAAEHNldF95aWVsZF90YXJnZXQAAAACAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAGdGFyZ2V0AAAAAAfQAAAAC1lpZWxkVGFyZ2V0AAAAAAA=",
            "AAAAAAAAAFdSZWRlZW1zIHNhdmluZ3Mgc2hhcmVzIGZyb20gYHVzZXJgJ3MgeWllbGQgc291cmNlIGFuZCBzZW5kcyB0aGUKcmVzdWx0aW5nIFVTREMgdG8gdGhlbS4AAAAAEHdpdGhkcmF3X3NhdmluZ3MAAAACAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAGc2hhcmVzAAAAAAALAAAAAQAAAAs=",
            "AAAABAAAAAAAAAAAAAAADE93bmFibGVFcnJvcgAAAAMAAAAAAAAAC093bmVyTm90U2V0AAAACDQAAAAAAAAAElRyYW5zZmVySW5Qcm9ncmVzcwAAAAAINQAAAAAAAAAPT3duZXJBbHJlYWR5U2V0AAAACDY=",
            "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gdGhlIGNvbnRyYWN0IGlzIHBhdXNlZC4AAAAAAAAAAAAGUGF1c2VkAAAAAAABAAAABnBhdXNlZAAAAAAAAAAAAAI=",
            "AAAABQAAACxFdmVudCBlbWl0dGVkIHdoZW4gdGhlIGNvbnRyYWN0IGlzIHVucGF1c2VkLgAAAAAAAAAIVW5wYXVzZWQAAAABAAAACHVucGF1c2VkAAAAAAAAAAI=",
            "AAAABAAAAAAAAAAAAAAADVBhdXNhYmxlRXJyb3IAAAAAAAACAAAANFRoZSBvcGVyYXRpb24gZmFpbGVkIGJlY2F1c2UgdGhlIGNvbnRyYWN0IGlzIHBhdXNlZC4AAAANRW5mb3JjZWRQYXVzZQAAAAAAA+gAAAA4VGhlIG9wZXJhdGlvbiBmYWlsZWQgYmVjYXVzZSB0aGUgY29udHJhY3QgaXMgbm90IHBhdXNlZC4AAAANRXhwZWN0ZWRQYXVzZQAAAAAAA+k="]), options);
        this.options = options;
    }
    fromJSON = {
        pay: (this.txFromJSON),
        usdc: (this.txFromJSON),
        owner: (this.txFromJSON),
        pause: (this.txFromJSON),
        vault: (this.txFromJSON),
        paused: (this.txFromJSON),
        unpause: (this.txFromJSON),
        set_lock: (this.txFromJSON),
        set_split: (this.txFromJSON),
        account_of: (this.txFromJSON),
        blend_pool: (this.txFromJSON),
        soroswap_pair: (this.txFromJSON),
        withdraw_spend: (this.txFromJSON),
        set_yield_target: (this.txFromJSON),
        withdraw_savings: (this.txFromJSON)
    };
}
