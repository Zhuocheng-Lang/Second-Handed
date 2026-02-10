export interface IdentityKeyPair {
  publicKey: string;
  privateKey: string;
  x25519PublicKey?: string;
  x25519PrivateKey?: string;
}

export interface X25519KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface Ciphertext {
  iv: string;
  data: string;
}
