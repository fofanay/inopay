import { Link } from "react-router-dom";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Layout from "@/components/layout/Layout";

const PaymentSuccess = () => {
  return (
    <Layout>
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-lg mx-auto">
            <Card className="card-shadow-lg border border-border">
              <CardContent className="pt-12 pb-10 text-center">
                <div className="mx-auto h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mb-6">
                  <CheckCircle2 className="h-10 w-10 text-success" />
                </div>
                
                <h1 className="text-3xl font-bold mb-4 text-foreground">
                  Paiement réussi !
                </h1>
                
                <p className="text-lg text-muted-foreground mb-8">
                  Merci pour votre confiance. Votre compte a été mis à jour et vous pouvez maintenant libérer vos projets.
                </p>

                <div className="space-y-4">
                  <Link to="/dashboard">
                    <Button size="lg" className="w-full rounded-xl shadow-lg">
                      <Sparkles className="h-5 w-5 mr-2" />
                      Libérer mon projet
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Button>
                  </Link>
                  
                  <Link to="/">
                    <Button variant="outline" size="lg" className="w-full rounded-xl">
                      Retour à l'accueil
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default PaymentSuccess;
