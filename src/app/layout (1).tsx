import type {Metadata} from 'next';
import { Poppins } from 'next/font/google'; // Changed font to Poppins
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '600', '700'], // Include needed weights
  variable: '--font-sans'
});

export const metadata: Metadata = {
  title: 'Medibot-AI', // Updated title
  description: 'AI care at your fingertips.', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Removed 'dark' class - theme is now controlled solely by CSS variables in globals.css
    <html lang="en">
      <body className={`${poppins.variable} antialiased font-sans`}> {/* Use Poppins font class */}
        {children}
        <Toaster /> {/* Add Toaster component */}
      </body>
    </html>
  );
}
