"use client";

import { useMemo, useState, ChangeEvent, FormEvent } from "react";

const WORK_TYPES = [
  {
    value: "new",
    title: "Construção nova",
    description: "Vou começar uma obra do zero em um terreno ou lote.",
  },
  {
    value: "renovation",
    title: "Reforma",
    description: "Quero reformar, ampliar ou adaptar um espaço existente.",
  },
] as const;

const PROPERTY_TYPES = [
  {
    value: "apartment",
    title: "Apartamento",
    description: "Unidade em prédio residencial ou comercial.",
  },
  {
    value: "house",
    title: "Casa",
    description: "Residência térrea, sobrado ou casa em condomínio.",
  },
] as const;

const RESPONSIBLE_ROLES = [
  { value: "architect", label: "Arquiteto(a)" },
  { value: "engineer", label: "Engenheiro(a) / Construtor(a)" },
] as const;

type WorkType = (typeof WORK_TYPES)[number]["value"];
type PropertyType = (typeof PROPERTY_TYPES)[number]["value"];
type ResponsibleRole = (typeof RESPONSIBLE_ROLES)[number]["value"];

type Responsible = {
  id: number;
  name: string;
  email: string;
  role: ResponsibleRole;
};

type Step = {
  title: string;
  description: string;
};

const steps: Step[] = [
  {
    title: "Tipo de obra",
    description:
      "Conte para a gente se você está começando uma construção do zero ou se vai reformar um espaço existente.",
  },
  {
    title: "Tipo do imóvel",
    description:
      "Selecione se o projeto é para um apartamento ou para uma casa, isso nos ajuda a direcionar as próximas etapas.",
  },
  {
    title: "Local da obra",
    description:
      "Informe o endereço da obra. Você pode colar o link do Google Maps ou digitar o endereço manualmente.",
  },
  {
    title: "Data de início",
    description:
      "Quando você pretende iniciar a obra? Assim conseguimos preparar o cronograma e os responsáveis.",
  },
  {
    title: "Plantas e documentos",
    description:
      "Envie plantas, croquis ou outros arquivos que ajudem a contextualizar o projeto.",
  },
  {
    title: "Responsáveis",
    description:
      "Adicione quem terá acesso ao projeto para colaborar e acompanhar o andamento.",
  },
  {
    title: "Resumo",
    description: "Revise os dados antes de finalizar a criação do seu projeto.",
  },
];

const INITIAL_RESPONSIBLE_FORM = {
  name: "",
  email: "",
  role: RESPONSIBLE_ROLES[0].value,
} as const;

export function ProjectCreationFlow() {
  const [currentStep, setCurrentStep] = useState(0);
  const [workType, setWorkType] = useState<WorkType | "">("");
  const [propertyType, setPropertyType] = useState<PropertyType | "">("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [planFiles, setPlanFiles] = useState<File[]>([]);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [responsibleForm, setResponsibleForm] = useState({ ...INITIAL_RESPONSIBLE_FORM });
  const [isFinished, setIsFinished] = useState(false);

  const canAdvance = useMemo(() => {
    switch (currentStep) {
      case 0:
        return workType !== "";
      case 1:
        return propertyType !== "";
      case 2:
        return location.trim().length > 5;
      case 3:
        return Boolean(startDate);
      case 4:
        return true;
      case 5: {
        const hasArchitect = responsibles.some((responsible) => responsible.role === "architect");
        const hasEngineer = responsibles.some((responsible) => responsible.role === "engineer");
        return hasArchitect && hasEngineer;
      }
      default:
        return true;
    }
  }, [currentStep, location, planFiles.length, propertyType, responsibles, startDate, workType]);

  const canFinish = useMemo(() => {
    if (!canAdvance) return false;
    return (
      responsibles.some((responsible) => responsible.role === "architect") &&
      responsibles.some((responsible) => responsible.role === "engineer")
    );
  }, [canAdvance, responsibles]);

  const handlePlanUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setPlanFiles((previous) => {
      const existingNames = new Set(previous.map((file) => file.name + file.lastModified));
      const filtered = files.filter((file) => !existingNames.has(file.name + file.lastModified));
      return [...previous, ...filtered];
    });
  };

  const handlePlanRemoval = (name: string, lastModified: number) => {
    setPlanFiles((previous) =>
      previous.filter((file) => !(file.name === name && file.lastModified === lastModified))
    );
  };

  const handleResponsibleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!responsibleForm.name.trim() || !responsibleForm.email.trim()) {
      return;
    }

    setResponsibles((previous) => [
      ...previous,
      {
        id: Date.now(),
        name: responsibleForm.name.trim(),
        email: responsibleForm.email.trim(),
        role: responsibleForm.role,
      },
    ]);
    setResponsibleForm({ ...INITIAL_RESPONSIBLE_FORM });
  };

  const handleResponsibleRemoval = (id: number) => {
    setResponsibles((previous) => previous.filter((responsible) => responsible.id !== id));
  };

  const goToNextStep = () => {
    if (currentStep === steps.length - 1) return;
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  };

  const goToPreviousStep = () => {
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  const handleFinish = () => {
    if (!canFinish) return;
    setIsFinished(true);
  };

  const resetFlow = () => {
    setCurrentStep(0);
    setWorkType("");
    setPropertyType("");
    setLocation("");
    setStartDate("");
    setPlanFiles([]);
    setResponsibles([]);
    setResponsibleForm({ ...INITIAL_RESPONSIBLE_FORM });
    setIsFinished(false);
  };

  const renderStepContent = () => {
    if (isFinished) {
      return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
          <h2 className="text-xl font-semibold">Projeto criado!</h2>
          <p className="mt-2 text-sm">
            Recebemos as informações principais da sua obra. Em breve você poderá
            acompanhar o andamento e convidar sua equipe diretamente pelo painel.
          </p>
          <button
            type="button"
            onClick={resetFlow}
            className="mt-6 rounded-lg border border-emerald-500 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
          >
            Criar outro projeto
          </button>
        </div>
      );
    }

    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Escolha a opção que melhor representa o estágio atual da sua obra.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {WORK_TYPES.map((option) => {
                const isActive = workType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setWorkType(option.value)}
                    className={`rounded-xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
                      isActive
                        ? "border-black bg-black text-white shadow-lg"
                        : "border-gray-200 hover:border-gray-400 hover:shadow"
                    }`}
                  >
                    <span className="text-base font-semibold">{option.title}</span>
                    <span className={`mt-2 block text-sm ${isActive ? "text-gray-100" : "text-gray-600"}`}>
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Precisamos saber o tipo de imóvel para ajustar as etapas da obra.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {PROPERTY_TYPES.map((option) => {
                const isActive = propertyType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPropertyType(option.value)}
                    className={`rounded-xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
                      isActive
                        ? "border-black bg-black text-white shadow-lg"
                        : "border-gray-200 hover:border-gray-400 hover:shadow"
                    }`}
                  >
                    <span className="text-base font-semibold">{option.title}</span>
                    <span className={`mt-2 block text-sm ${isActive ? "text-gray-100" : "text-gray-600"}`}>
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700" htmlFor="project-location">
              Endereço da obra
            </label>
            <input
              id="project-location"
              type="text"
              placeholder="Ex.: Rua Exemplo, 123 - São Paulo ou link do Google Maps"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
            <p className="text-xs text-gray-500">
              Caso já tenha salvo o local no Google Maps, cole o link acima para facilitar o acesso da equipe.
            </p>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700" htmlFor="project-start-date">
              Data prevista para início
            </label>
            <input
              id="project-start-date"
              type="date"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            <p className="text-xs text-gray-500">
              Não se preocupe, você poderá ajustar essa data depois, se necessário.
            </p>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Faça upload dos arquivos principais do projeto. Aceitamos plantas, memoriais e imagens em PDF, PNG ou JPG.
            </p>
            <label
              htmlFor="project-plans"
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 px-6 py-10 text-center transition hover:border-gray-400"
            >
              <span className="text-sm font-medium text-gray-700">Arraste os arquivos aqui</span>
              <span className="mt-2 text-xs text-gray-500">ou clique para selecionar do seu computador</span>
              <input
                id="project-plans"
                type="file"
                multiple
                className="sr-only"
                onChange={handlePlanUpload}
              />
            </label>
            {planFiles.length > 0 ? (
              <ul className="space-y-2">
                {planFiles.map((file) => (
                  <li
                    key={`${file.name}-${file.lastModified}`}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <div className="flex-1">
                      <span className="block truncate">{file.name}</span>
                      <span className="text-xs text-gray-500">{Math.round(file.size / 1024)} KB</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePlanRemoval(file.name, file.lastModified)}
                      className="ml-3 text-xs font-medium text-red-600 transition hover:text-red-700"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">
                Se ainda não tiver os arquivos em mãos, você poderá anexá-los depois.
              </p>
            )}
          </div>
        );
      case 5:
        return (
          <div className="space-y-6">
            <form className="space-y-3 rounded-xl border border-gray-200 p-4" onSubmit={handleResponsibleFormSubmit}>
              <h3 className="text-sm font-semibold text-gray-800">Convidar responsável</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600" htmlFor="responsible-name">
                    Nome completo
                  </label>
                  <input
                    id="responsible-name"
                    type="text"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                    value={responsibleForm.name}
                    onChange={(event) =>
                      setResponsibleForm((previous) => ({ ...previous, name: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600" htmlFor="responsible-email">
                    E-mail
                  </label>
                  <input
                    id="responsible-email"
                    type="email"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                    value={responsibleForm.email}
                    onChange={(event) =>
                      setResponsibleForm((previous) => ({ ...previous, email: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <span className="block text-xs font-medium text-gray-600">Perfil</span>
                <div className="flex flex-wrap gap-2">
                  {RESPONSIBLE_ROLES.map((role) => {
                    const isActive = responsibleForm.role === role.value;
                    return (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() =>
                          setResponsibleForm((previous) => ({ ...previous, role: role.value }))
                        }
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          isActive
                            ? "border-black bg-black text-white"
                            : "border-gray-300 hover:border-gray-400 hover:bg-gray-100"
                        }`}
                      >
                        {role.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/90"
              >
                Adicionar responsável
              </button>
            </form>

            <div>
              <h3 className="text-sm font-semibold text-gray-800">Equipe convidada</h3>
              {responsibles.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">
                  Ainda não há responsáveis. Adicione pelo menos um arquiteto e um engenheiro/construtor.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {responsibles.map((responsible) => (
                    <li
                      key={responsible.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-gray-800">{responsible.name}</p>
                        <p className="text-xs text-gray-500">{responsible.email}</p>
                        <p className="text-xs text-gray-500">
                          {responsible.role === "architect"
                            ? "Arquiteto(a)"
                            : "Engenheiro(a) / Construtor(a)"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleResponsibleRemoval(responsible.id)}
                        className="text-xs font-medium text-red-600 transition hover:text-red-700"
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-800">Informações gerais</h3>
              <dl className="mt-3 grid gap-2 text-sm text-gray-600">
                <div className="flex flex-col">
                  <dt className="text-xs uppercase text-gray-500">Tipo de obra</dt>
                  <dd>{WORK_TYPES.find((option) => option.value === workType)?.title ?? "-"}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs uppercase text-gray-500">Tipo do imóvel</dt>
                  <dd>{PROPERTY_TYPES.find((option) => option.value === propertyType)?.title ?? "-"}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs uppercase text-gray-500">Local da obra</dt>
                  <dd>{location}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs uppercase text-gray-500">Data de início</dt>
                  <dd>{startDate ? new Date(startDate + "T00:00:00").toLocaleDateString() : "-"}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-800">Plantas e documentos</h3>
              {planFiles.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">Nenhum arquivo anexado.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-gray-600">
                  {planFiles.map((file) => (
                    <li key={file.name} className="flex items-center justify-between">
                      <span className="truncate">{file.name}</span>
                      <span className="text-xs text-gray-500">{Math.round(file.size / 1024)} KB</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-800">Responsáveis</h3>
              {responsibles.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">Nenhum responsável adicionado.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-gray-600">
                  {responsibles.map((responsible) => (
                    <li key={responsible.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{responsible.name}</p>
                        <p className="text-xs text-gray-500">{responsible.email}</p>
                      </div>
                      <span className="text-xs uppercase text-gray-500">
                        {responsible.role === "architect" ? "Arquiteto(a)" : "Engenheiro(a) / Construtor(a)"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {!canFinish && (
                <p className="mt-3 text-xs text-red-600">
                  É necessário convidar pelo menos um arquiteto e um engenheiro/construtor antes de finalizar.
                </p>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <section className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Bem-vindo(a) ao Zenbild</p>
        <h1 className="text-2xl font-semibold text-gray-900">Vamos criar seu primeiro projeto</h1>
        <p className="text-sm text-gray-600">
          Responda algumas perguntas rápidas para configurarmos sua obra e compartilhar com a equipe certa.
        </p>
      </header>

      <ol className="flex flex-wrap gap-2 text-xs text-gray-500">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep || (isFinished && index === currentStep);
          return (
            <li
              key={step.title}
              className={`rounded-full border px-3 py-1 transition ${
                isActive
                  ? "border-black bg-black text-white"
                  : isCompleted
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-gray-200"
              }`}
            >
              {index + 1}. {step.title}
            </li>
          );
        })}
      </ol>

      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-gray-900">{steps[currentStep]?.title}</h2>
          <p className="text-sm text-gray-600">{steps[currentStep]?.description}</p>
        </div>
        {renderStepContent()}
      </div>

      {!isFinished && (
        <footer className="flex flex-wrap justify-between gap-3 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={goToPreviousStep}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-400 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={currentStep === 0}
          >
            Voltar
          </button>
          {currentStep < steps.length - 1 ? (
            <button
              type="button"
              onClick={goToNextStep}
              disabled={!canAdvance}
              className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Avançar
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={!canFinish}
              className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Finalizar projeto
            </button>
          )}
        </footer>
      )}
    </section>
  );
}
