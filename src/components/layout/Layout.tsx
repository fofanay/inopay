import { ReactNode } from "react";
import Header from "./Header";
import Footer from "./Footer";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      {/* pt-32 pour le header 3 niveaux sur desktop, pt-20 sur mobile */}
      <main className="flex-1 pt-20 md:pt-36">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
