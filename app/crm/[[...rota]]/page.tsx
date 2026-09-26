import { CarregadorCrm } from "../_componentes/CarregadorCrm";

// Rota única do CRM: /crm, /crm/leads, /crm/casos/<id> etc. A navegação interna
// acontece no navegador; qualquer endereço funciona em acesso direto e ao
// atualizar a página.
export default function PaginaCrm() {
  return <CarregadorCrm />;
}
