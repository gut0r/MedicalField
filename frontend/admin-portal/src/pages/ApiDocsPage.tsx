export function ApiDocsPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold">Documentação das APIs</h1>
      <p className="mb-6 text-slate-500">
        Consulte todos os endpoints do MedicalField em uma única página.
      </p>

      <div className="card max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          OpenAPI unificada
        </p>
        <h2 className="mt-2 text-xl font-semibold">Todas as APIs, organizadas por serviço</h2>
        <p className="mt-2 text-slate-600">
          Autenticação, pacientes, prontuários, medicamentos, sincronização e documentos
          aparecem juntos. Use o botão <strong>Authorize</strong> uma vez para testar as rotas protegidas.
        </p>
        <a
          className="btn-primary mt-5"
          href="/documentation/"
          target="_blank"
          rel="noreferrer"
        >
          Ver documentação completa
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  );
}

