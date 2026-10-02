from __future__ import annotations

from typing import List


from .parsers.base_parser import BaseStatementParser
from .parsers.easypaisa_parser import EasypaisaParser
from .parsers.sadapay_parser import SadaPayParser
from .parsers.myabl_parser import MyABLParser
from .parsers.unknown_bank_parser import UnknownBankParser


_PARSERS: List[BaseStatementParser] = [
    EasypaisaParser(),
    SadaPayParser(),
    MyABLParser(),
    UnknownBankParser(),
]


def get_parsers() -> List[BaseStatementParser]:
    return _PARSERS
