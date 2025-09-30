import { Briefcase, GraduationCap, Heart, Smartphone } from 'lucide-react';

const useCases = [
  {
    icon: Briefcase,
    title: 'Para Profesionales Independientes',
    scenario: 'María, consultora',
    description: '"Antes pasaba horas coordinando citas con clientes. Ahora migue.ai agenda todo automáticamente y me recuerda las reuniones. Recuperé 3 horas semanales para enfocarme en mi trabajo."',
    benefits: ['Coordinación automática de citas', 'Recordatorios inteligentes', 'Transcripción de llamadas'],
    gradient: 'from-primary-500 to-primary-600',
  },
  {
    icon: GraduationCap,
    title: 'Para Estudiantes',
    scenario: 'Carlos, universitario',
    description: '"Las clases graban audios largos. Antes perdía horas tomando notas. Ahora envío los audios a migue.ai y los tengo transcritos. ¡Mis calificaciones mejoraron!"',
    benefits: ['Transcripción de clases', 'Resumen de PDFs', 'Recordatorios de tareas'],
    gradient: 'from-secondary-500 to-secondary-600',
  },
  {
    icon: Heart,
    title: 'Para Pequeños Negocios',
    scenario: 'Ana, dueña de spa',
    description: '"Mis clientes cancelan y olvido reagendar. migue.ai envía confirmaciones automáticas y me ayuda a recuperar citas perdidas. Aumenté 20% mis reservas."',
    benefits: ['Confirmaciones automáticas', 'Recuperación de cancelaciones', 'Mensajes programados'],
    gradient: 'from-accent-green-500 to-accent-green-600',
  },
  {
    icon: Smartphone,
    title: 'Para Creadores de Contenido',
    scenario: 'Luis, YouTuber',
    description: '"Veo muchos videos de competencia. migue.ai me da resúmenes en segundos. Ahorro 10+ horas semanales investigando tendencias y me enfoco en crear."',
    benefits: ['Resúmenes de videos', 'Análisis de tendencias', 'Programación de contenido'],
    gradient: 'from-accent-orange-500 to-accent-orange-600',
  },
];

export function UseCases(): React.JSX.Element {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Personas reales,
            <br />
            <span className="text-primary-600">resultados reales</span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Descubre cómo diferentes personas usan migue.ai para ahorrar tiempo y mejorar su productividad cada día.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {useCases.map((useCase) => {
            const Icon = useCase.icon;
            return (
              <div
                key={useCase.title}
                className="relative p-8 rounded-3xl bg-gradient-to-br from-slate-50 to-white border border-slate-200 hover:shadow-2xl transition-all duration-300 overflow-hidden group"
              >
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${useCase.gradient} opacity-10 rounded-bl-full group-hover:scale-150 transition-transform duration-500`}></div>

                <div className="relative">
                  <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${useCase.gradient} text-white mb-4 shadow-lg`}>
                    <Icon className="w-8 h-8" />
                  </div>

                  <h3 className="text-2xl font-bold text-slate-900 mb-2">
                    {useCase.title}
                  </h3>

                  <p className="text-sm font-semibold text-primary-600 mb-4">
                    {useCase.scenario}
                  </p>

                  <blockquote className="text-slate-700 italic mb-6 leading-relaxed">
                    {useCase.description}
                  </blockquote>

                  <div className="space-y-2">
                    {useCase.benefits.map((benefit) => (
                      <div key={benefit} className="flex items-center gap-2 text-sm text-slate-600">
                        <svg className="w-5 h-5 text-accent-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}