import { MessageCircle, Sparkles, Zap } from 'lucide-react';

const steps = [
  {
    icon: MessageCircle,
    number: '01',
    title: 'Abre WhatsApp',
    description: 'Guarda el número de migue.ai en tus contactos y envía tu primer mensaje. Es tan fácil como chatear con un amigo.',
    color: 'from-primary-500 to-primary-600',
  },
  {
    icon: Sparkles,
    number: '02',
    title: 'Habla Naturalmente',
    description: 'Pide lo que necesites con tus propias palabras. "Recuérdame comprar leche mañana" o "Resume este PDF". Así de simple.',
    color: 'from-secondary-500 to-secondary-600',
  },
  {
    icon: Zap,
    number: '03',
    title: 'Recibe Respuestas Instantáneas',
    description: 'migue.ai procesa tu solicitud en 1-2 segundos. Respuestas rápidas, precisas y siempre disponibles 24/7.',
    color: 'from-accent-green-500 to-accent-green-600',
  },
];

export function HowItWorks(): React.JSX.Element {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Tan fácil que
            <br />
            <span className="text-primary-600">cualquiera puede usarlo</span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            No necesitas ser experto en tecnología. Si sabes usar WhatsApp, ya sabes usar migue.ai.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isLast = index === steps.length - 1;

            return (
              <div key={step.number} className="relative">
                <div className="text-center">
                  <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br ${step.color} text-white mb-6 shadow-lg`}>
                    <Icon className="w-10 h-10" />
                  </div>

                  <div className="mb-4">
                    <span className="inline-block text-5xl font-bold text-slate-200 mb-2">
                      {step.number}
                    </span>
                  </div>

                  <h3 className="text-2xl font-bold text-slate-900 mb-3">
                    {step.title}
                  </h3>

                  <p className="text-slate-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {!isLast && (
                  <div className="hidden md:block absolute top-10 left-full w-full h-0.5 -ml-6 -translate-x-6">
                    <div className="w-full h-full bg-gradient-to-r from-slate-300 to-slate-200"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-white rounded-full shadow-md">
            <div className="w-2 h-2 bg-accent-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-slate-700">
              Respuestas en 1-2 segundos promedio
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}