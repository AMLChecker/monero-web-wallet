# Third-party notices

Monero Web Wallet itself is MIT-licensed — see [LICENSE](LICENSE).

## Monero binaries in the release package

The downloadable package `monero-web-wallet-<version>.zip` published on the
[releases page](https://github.com/AMLChecker/monero-web-wallet/releases) bundles three
unmodified binaries from the official Monero release, so that `Start.bat` works without
downloading anything else:

| File | Purpose |
| --- | --- |
| `monero-wallet-rpc.exe` | the wallet RPC server every wallet operation goes through |
| `monerod.exe` | a full node, used when no other node is configured |
| `monero-wallet-cli.exe` | the official command line wallet, for recovery and scripting |

- Version: **Monero 'Fluorine Fermi' v0.18.5.1-release (Windows x64)**
- Source: <https://www.getmonero.org/downloads/> (release signed by the Monero maintainers)
- Licence: BSD 3-Clause, reproduced below in full
- The files are copied byte for byte; nothing in them is patched, rebuilt or renamed.

Windows Defender sometimes quarantines these executables. If `Start.bat` reports that
`monero-wallet-rpc.exe` is missing, restore it from **Windows Security → Protection history**
and add the folder to **Exclusions**. This wallet never mines anything and never modifies the
binaries.

## Monero licence (BSD 3-Clause)

```text
Copyright (c) 2014-2022, The Monero Project

All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
this list of conditions and the following disclaimer in the documentation
and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
may be used to endorse or promote products derived from this software without
specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

Parts of the project are originally copyright (c) 2012-2013 The Cryptonote
developers

Parts of the project are originally copyright (c) 2014 The Boolberry
developers, distributed under the MIT licence:

  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## npm dependencies

The backend and frontend use the packages listed in `backend/package.json` and
`frontend/package.json`; their licences are recorded in the respective `package-lock.json`
files and in `node_modules/<package>/LICENSE` inside the release package.
