from solders.pubkey import Pubkey
from solders.signature import Signature


def verify_signature(wallet: str, message: str, signature_b58: str) -> bool:
    try:
        pk = Pubkey.from_string(wallet)
        sig = Signature.from_string(signature_b58)
    except ValueError:
        return False
    return sig.verify(pk, message.encode("utf-8"))
