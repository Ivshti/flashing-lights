// BOM / assembly data for the LED board. LCSC numbers left empty are not
// verified yet: search LCSC by the MPN/value before ordering.
export default {
  name: "led-board",
  parts: [
    {
      match: /^D\d\d$/,
      comment: "LED 3535 RGBA 4-in-1, 350 mA/die",
      footprint: "LED3535-8 (custom)",
      note: "CHOOSE PART, then verify pinout against hardware/lib/led3535.tsx",
    },
    { match: /^Q\d[RGBA]$/, comment: "AO3400A", footprint: "SOT-23", lcsc: "C20917", mpn: "AO3400A" },
    { match: /^U\d[RGBA]$/, comment: "LMV321 (TI pinout: 1=IN+ 2=V- 3=IN- 4=OUT 5=V+)", footprint: "SOT-23-5", mpn: "LMV321IDBVR" },
    { match: /^RS/, comment: "0.33R 1% 1206", footprint: "1206", mpn: "0.33R 1206 1%" },
    { match: /^RG/, comment: "100R 1% 0402", footprint: "0402", lcsc: "C25076" },
    { match: /^RP/, comment: "100k 1% 0402", footprint: "0402", lcsc: "C25741" },
    { match: /^RT\d[RGBA]$/, comment: "27k 1% 0402", footprint: "0402", mpn: "27k 0402 1%" },
    { match: /^RB/, comment: "1k 1% 0402", footprint: "0402", lcsc: "C11702" },
    { match: /^CD/, comment: "100nF 16V X7R 0402", footprint: "0402", lcsc: "C1525" },
    { match: /^JP/, comment: "0R jumper 1206", footprint: "1206", mpn: "0R 1206" },
    { match: /^JV/, comment: "0R jumper 2512 (>=3 A)", footprint: "2512", mpn: "0R 2512" },
    { match: /^U1$/, comment: "PCA9685PW", footprint: "TSSOP-28", mpn: "PCA9685PW,118" },
    { match: /^C1$/, comment: "100nF 16V X7R 0402", footprint: "0402", lcsc: "C1525" },
    { match: /^C2$/, comment: "1uF 10V X5R 0402", footprint: "0402", lcsc: "C52923" },
    { match: /^RT1$/, comment: "NTC 10k B3380 0603", footprint: "0603", mpn: "NCP18XH103F03RB" },
    { match: /^(P_|TV|TG)/, comment: "copper only", footprint: "-", dnp: true },
  ],
}
