#!/usr/bin/env bash
# Descarga fotos libres (LoremFlickr, CC) para las opciones proyectivas.
# Determinista por ?lock=. Reemplazá cualquier archivo a mano si no te gusta.
set -uo pipefail
base="public/projective"
fail=0

dl() { # dl <subdir> <id> <keyword> <lock>
  local dir="$base/$1" out
  mkdir -p "$dir"
  out="$dir/$2.jpg"
  if curl -fsSL "https://loremflickr.com/600/600/$3?lock=$4" -o "$out" && [ -s "$out" ]; then
    echo "ok    $out"
  else
    echo "FALTA $out (keyword=$3)"; fail=$((fail+1)); rm -f "$out"
  fi
}

# animal
dl animal conejo rabbit 11
dl animal caballo horse 12
dl animal leon lion 13
dl animal delfin dolphin 14
dl animal aguila eagle 15
dl animal iguana iguana 16
dl animal perro dog 17
dl animal gato cat 18
dl animal flamenco flamingo 19
# olor
dl olor cerezo cherry,blossom 21
dl olor pina pinecone 22
dl olor cesped grass 23
dl olor rio river 24
dl olor caramelos candy 25
dl olor madera wood,logs 26
dl olor hierba mint 27
dl olor naranjas oranges 28
dl olor rosas roses 29
# ciudad
dl ciudad bali bali 31
dl ciudad ny newyork 32
dl ciudad barcelona barcelona 33
dl ciudad delhi delhi 34
dl ciudad lasvegas lasvegas 35
dl ciudad berlin berlin 36
dl ciudad paris paris 37
dl ciudad dubai dubai 38
dl ciudad marrakech marrakech 39
# edad hombre (retratos genéricos; la etiqueta de década va en la UI)
dl edad-hombre 20s man,portrait 41
dl edad-hombre 30s man,portrait 42
dl edad-hombre 40s man,portrait 43
dl edad-hombre 50s man,portrait 44
dl edad-hombre 60s man,portrait 45
# edad mujer
dl edad-mujer 20s woman,portrait 51
dl edad-mujer 30s woman,portrait 52
dl edad-mujer 40s woman,portrait 53
dl edad-mujer 50s woman,portrait 54
dl edad-mujer 60s woman,portrait 55

echo "---"
total=$(find "$base" -name '*.jpg' | wc -l | tr -d ' ')
echo "descargadas: $total/37  (faltaron: $fail)"
exit 0
