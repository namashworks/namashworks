"""Educational sign-entropy statistic, not the STAM implementation."""
from math import log2


def sign_entropy(signs):
    """Return binary entropy for a non-empty sequence of -1/+1 signs.

    Zero errors need a caller-defined policy and are deliberately excluded.
    Entropy alone does not establish noise, drift, or model quality.
    """
    signs = tuple(signs)
    if not signs or any(type(s) is not int or s not in (-1, 1) for s in signs):
        raise ValueError("Provide at least one sign, each an integer -1 or +1.")
    p = sum(s == 1 for s in signs) / len(signs)
    return 0.0 if p in (0.0, 1.0) else -p * log2(p) - (1 - p) * log2(1 - p)
