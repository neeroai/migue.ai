import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'migue.ai - Tu Asistente Personal de IA en WhatsApp',
  description: 'Ahorra tiempo y nunca olvides nada. Tu asistente personal de inteligencia artificial que vive en WhatsApp. Gestiona citas, transcribe audios, analiza documentos y mucho más.',
  keywords: ['WhatsApp', 'IA', 'asistente virtual', 'inteligencia artificial', 'productividad', 'automatización'],
  authors: [{ name: 'migue.ai' }],
  openGraph: {
    title: 'migue.ai - Tu Asistente Personal de IA en WhatsApp',
    description: 'Ahorra tiempo y nunca olvides nada con tu asistente personal de IA',
    type: 'website',
    locale: 'es_ES',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'migue.ai - Tu Asistente Personal de IA en WhatsApp',
    description: 'Ahorra tiempo y nunca olvides nada con tu asistente personal de IA',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
