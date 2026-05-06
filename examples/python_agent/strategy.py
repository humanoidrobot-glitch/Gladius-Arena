"""Naive momentum signal — pure logic, no I/O.

Maintains a deque of recent prices and emits a buy / sell / hold signal
based on the percentage move from the start to the end of the window.
The thresholds are configurable so the same code services aggressive
and conservative agents.
"""

from collections import deque
from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

Signal = Literal["buy", "sell", "hold"]


@dataclass
class MomentumStrategy:
    lookback: int = 12
    buy_threshold_bps: int = 80
    sell_threshold_bps: int = 80

    def __post_init__(self) -> None:
        self._prices: deque[Decimal] = deque(maxlen=self.lookback)

    def observe(self, price: Decimal) -> None:
        self._prices.append(price)

    def signal(self) -> tuple[Signal, Decimal | None]:
        """Return the signal and the change-bps that produced it (or None
        when not enough data has accumulated)."""
        if len(self._prices) < self.lookback:
            return "hold", None
        first = self._prices[0]
        last = self._prices[-1]
        if first == 0:
            return "hold", None
        change_bps = (last - first) / first * Decimal(10_000)
        if change_bps >= self.buy_threshold_bps:
            return "buy", change_bps
        if change_bps <= -self.sell_threshold_bps:
            return "sell", change_bps
        return "hold", change_bps
