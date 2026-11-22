# Deployment — Base Sepolia (chain 84532)

| | |
|---|---|
| Contract | [`0x210312F9C553a02A9864CC9685854A72d49D4F7e`](https://sepolia.basescan.org/address/0x210312F9C553a02A9864CC9685854A72d49D4F7e) |
| Deploy tx | [`0x2582fd6b…`](https://sepolia.basescan.org/tx/0x2582fd6b3a46e58f283b42cb7939d9038c39f09bf6c4ff1c529bf1c236b8f863) |
| Deploy block | 61941981 |
| Admin (Club Advisor) | `0x76b76ed71c729333550e0a38b0d43d4a85facf15` |
| Source verification | [BaseScan: verified](https://sepolia.basescan.org/address/0x210312F9C553a02A9864CC9685854A72d49D4F7e#code) · [Sourcify: exact match](https://sourcify.dev/server/v2/contract/84532/0x210312F9C553a02A9864CC9685854A72d49D4F7e) |
| Live site | https://clubledger-kappa.vercel.app |

## Headline proofs (SPEC §2.9)

| Rule | ✓ Passed | ✗ Refused (reverted on-chain) |
|---|---|---|
| 1 Only authorised treasurers can record money | [`0xec9f42c3…`](https://sepolia.basescan.org/tx/0xec9f42c3aee54860222a41fbdc8ee11d7fe9b0eaf7d12e4306751dc0fff9773d) INC-0001 posted by Treasurer | [`0xd257bd63…`](https://sepolia.basescan.org/tx/0xd257bd631b24a9cc76984cabc3e6a0a90cc63a8818d7441089be5df9fb6ce540) Random member posts EXP-9001 → `Not an authorised poster` |
| 2 The books can never go negative | [`0xb2e76df7…`](https://sepolia.basescan.org/tx/0xb2e76df785986d8c6d34c6c2bda8d1cb39fe63ea6da12e3fd5846885980d3c8e) EXP-0001 posted | [`0x09a7394a…`](https://sepolia.basescan.org/tx/0x09a7394a12ace66719cd6039ab7888a9f550612ea62e7b6259c3f2395fa166dd) Treasurer posts EXP-9002 for AED 50,000 → `Expense exceeds club balance` |
| 3 A receipt can only be recorded once | [`0xec9f42c3…`](https://sepolia.basescan.org/tx/0xec9f42c3aee54860222a41fbdc8ee11d7fe9b0eaf7d12e4306751dc0fff9773d) INC-0001 posted | [`0xfc4b3fec…`](https://sepolia.basescan.org/tx/0xfc4b3fec2641bcde6acdbbebf34bc67dc20de5c8f1e21034e63397ba556bd8ba) Treasurer re-posts INC-0001 → `Reference code already used` |
| 4 No edits — only corrections | [`0xc46b6127…`](https://sepolia.basescan.org/tx/0xc46b612799926b6448845d8b3a033a44058c5cbae0d44f7c1f87c2df1375d7a9) EXP-0002 corrected 420 → 380 | [`0x292a9133…`](https://sepolia.basescan.org/tx/0x292a91339f29dc1b3cdabc6b1ade0bfbfed476085e559f2016f555e4b305a96d) Treasurer corrects the original EXP-0002 again → `Entry already corrected - correct the latest version` |

Treasurer authorisation: [`0x95043c0b…`](https://sepolia.basescan.org/tx/0x95043c0bd4a1f27d559d2cac015da03dc18e0feea24e8ac336fe6e721c9d8556)

## Every seed transaction

| # | Action | Tx | Status |
|---|---|---|---|
| 1 | Authorise "Treasurer" (0xDe0d0a1A8C908Cb9a05B607bF36A293Cf5B0594a) | [`0x95043c0b…`](https://sepolia.basescan.org/tx/0x95043c0bd4a1f27d559d2cac015da03dc18e0feea24e8ac336fe6e721c9d8556) | ✓ |
| 2 | Authorise "Asst. Treasurer" (0xec1FDFE6D7858E054EbF6Ff91ae85d8D2c3B4Fff) | [`0xb090eebc…`](https://sepolia.basescan.org/tx/0xb090eebce88ef5e187893b35f2ceda58b37a1021d8caf78535ecdb5743fc1311) | ✓ |
| 3 | Post INC-0001 (Income, AED 5000.00) | [`0xec9f42c3…`](https://sepolia.basescan.org/tx/0xec9f42c3aee54860222a41fbdc8ee11d7fe9b0eaf7d12e4306751dc0fff9773d) | ✓ |
| 4 | Post INC-0002 (Income, AED 1200.00) | [`0xd6a5641b…`](https://sepolia.basescan.org/tx/0xd6a5641b3f3921f475dbecbdf5e39a21ee0fbe2f76ba8cf77e6c322f85b8f310) | ✓ |
| 5 | Post INC-0003 (Income, AED 2500.00) | [`0x7286ec41…`](https://sepolia.basescan.org/tx/0x7286ec410f2ad17589709a7bb264f068076ddf1eed5bbc007b0642e069ec60cd) | ✓ |
| 6 | Post EXP-0001 (Expense, AED 1850.00) | [`0xb2e76df7…`](https://sepolia.basescan.org/tx/0xb2e76df785986d8c6d34c6c2bda8d1cb39fe63ea6da12e3fd5846885980d3c8e) | ✓ |
| 7 | Post EXP-0002 (Expense, AED 420.00) | [`0xd70b5afd…`](https://sepolia.basescan.org/tx/0xd70b5afd01b4c09a3cec0d54dc55f1d4fbb2e7490e68b372b2e4130138734de2) | ✓ |
| 8 | Post EXP-0003 (Expense, AED 900.00) | [`0xfd982c37…`](https://sepolia.basescan.org/tx/0xfd982c37190ba378d8124e068bfb3d05171f418e410f0d274a5c24598281c9b0) | ✓ |
| 9 | Post EXP-0004 (Expense, AED 300.00) | [`0x65811e12…`](https://sepolia.basescan.org/tx/0x65811e12e39110e32fd6d73c8ca67f552429096d65e01d00420a55eebc892d14) | ✓ |
| 10 | Post INC-0004 (Income, AED 750.00) | [`0x004129a5…`](https://sepolia.basescan.org/tx/0x004129a5ed4d6486db091d36b4113c4debcb51f8b90ce2af8f4a7de06dc90c6d) | ✓ |
| 11 | Post EXP-0005 (Expense, AED 640.00) | [`0xc7de65d2…`](https://sepolia.basescan.org/tx/0xc7de65d2379ae2d065698d933ccb824d3f65cb986d9ec0939d11610d251c9fe6) | ✓ |
| 12 | Post EXP-0006 (Expense, AED 1100.00) | [`0x153382b9…`](https://sepolia.basescan.org/tx/0x153382b9fbee830ee7f358befe9df0c676221dbfde3094584bff0d1e44b54ae2) | ✓ |
| 13 | Correct entry #5 → AED 380.00 ("Vendor refunded AED 40 for undelivered items") | [`0xc46b6127…`](https://sepolia.basescan.org/tx/0xc46b612799926b6448845d8b3a033a44058c5cbae0d44f7c1f87c2df1375d7a9) | ✓ |
| 14 | Correct entry #7 → AED 0.00 ("Duplicate — invoice already paid by Student Council") | [`0xc50e49bf…`](https://sepolia.basescan.org/tx/0xc50e49bfc68a2467dd65774723aedd9cbe040d634125672817a65b14ebe4ed82) | ✓ |
