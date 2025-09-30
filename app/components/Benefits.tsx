import { Clock, DollarSign, Smartphone, Shield, Zap, Users } from 'lucide-react';

const benefits = [
  {
    icon: Clock,
    title: 'Ahorra 5+ Horas Semanales',
    description: 'Automatiza tareas repetitivas y enfócate en lo que realmente importa. Tiempo es dinero.',
  },
  {
    icon: Smartphone,
    title: 'Cero Apps Nuevas',
    description: 'Todo funciona en WhatsApp. No necesitas descargar nada ni aprender a usar otra aplicación.',
  },
  {
    icon: Zap,
    title: 'Respuestas Ultra Rápidas',
    description: 'Responde en 1-2 segundos promedio. Más rápido que escribir un mensaje tú mismo.',
  },
  {
    icon: DollarSign,
    title: 'Precio Accesible',
    description: 'Empieza gratis. Planes desde $9/mes. Mucho más barato que contratar un asistente.',
  },
  {
    icon: Shield,
    title: 'Privacidad y Seguridad',
    description: 'Tus datos están seguros. Usamos encriptación de extremo a extremo y nunca compartimos tu información.',
  },
  {
    icon: Users,
    title: 'Soporte en Español',
    description: 'Equipo latino que entiende tus necesidades. Soporte rápido y en tu idioma.',
  },
];

export function Benefits(): React.JSX.Element {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            ¿Por qué elegir
            <br />
            <span className="text-primary-600">migue.ai?</span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            La forma más inteligente de gestionar tu día a día, sin complicaciones ni curvas de aprendizaje.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div
                key={benefit.title}
                className="group p-6 rounded-2xl bg-white hover:shadow-xl transition-all duration-300 border border-slate-200"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 p-3 rounded-xl bg-gradient-primary group-hover:scale-110 transition-transform">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 p-8 rounded-3xl bg-gradient-primary text-white text-center">
          <h3 className="text-2xl sm:text-3xl font-bold mb-4">
            ¿Listo para recuperar tu tiempo?
          </h3>
          <p className="text-lg text-white/90 mb-6 max-w-2xl mx-auto">
            Únete a más de 1,000 personas que ya están usando migue.ai para ser más productivos cada día.
          </p>
          <button className="px-8 py-4 bg-white text-primary-600 font-semibold rounded-lg hover:shadow-xl transition-all hover:scale-105">
            Comenzar Gratis Ahora
          </button>
          <p className="text-sm text-white/70 mt-4">
            No requiere tarjeta de crédito • Cancela cuando quieras
          </p>
        </div>
      </div>
    </section>
  );
}