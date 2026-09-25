"""The signer: its store, seal, keys, issuers and ceremonies, together."""

from harpocrates_signer.ceremonies import Ceremonies
from harpocrates_signer.config import Config, read_token
from harpocrates_signer.keys import Keys
from harpocrates_signer.signing import Issuers
from harpocrates_signer.store import Store
from harpocrates_signer.vault import Vault, VaultStatus


class Signer:
    def __init__(self, config: Config) -> None:
        self.token = read_token(config.token_file)
        self.store = Store(config.store_path)
        self.vault = Vault(self.store, config.unseal_key_file)
        self.keys = Keys(self.store, self.vault)
        self.issuers = Issuers(self.store, self.keys)
        self.ceremonies = Ceremonies(self.vault, self.keys, config.ceremony_timeout)

    def start(self) -> VaultStatus:
        return self.vault.start()

    def seal(self) -> None:
        """Seal, and end any ceremony: nothing signs while sealed."""
        self.ceremonies.close()
        self.vault.seal()

    def close(self) -> None:
        self.ceremonies.close()
        self.store.close()
