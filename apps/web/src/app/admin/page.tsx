/**
 * Entrada de `/admin`.
 *
 * Não existe painel geral de administração — o primeiro destino útil para quem
 * entra é a lista de conjuntos de limiares, o coração da regra 1 do ADR-001.
 */

import { redirect } from 'next/navigation';

export default function PaginaDoAdmin() {
  redirect('/admin/limiares');
}
