/**
 * Junta classes ignorando o que for falso.
 *
 * Mora fora de `primitivos.tsx` porque aquele módulo é `'use client'` — o `Campo`
 * guarda o estado do alternador de senha. Uma função pura exportada de módulo
 * cliente não pode ser CHAMADA por componente de servidor, só renderizada como
 * componente; e `admin/cadastros/page.tsx` chama esta aqui direto. O build de
 * produção quebrava com "Attempted to call juntar() from the server".
 *
 * Nem typecheck nem lint pegam essa fronteira. Só o build.
 */
export function juntar(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
