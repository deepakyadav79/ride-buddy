import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import { Car, MapPin, Shield, Clock, Users, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const features = [
  { icon: MapPin, title: "Live Tracking", desc: "Track your ride in real-time on the map" },
  { icon: Shield, title: "Safe Rides", desc: "Emergency contacts & route monitoring" },
  { icon: Clock, title: "On Time", desc: "Reliable pickups with ETA updates" },
  { icon: Users, title: "Share Rides", desc: "Split costs with fellow travelers" },
  { icon: Zap, title: "Instant Booking", desc: "Book your ride in seconds" },
  { icon: Car, title: "Choose Vehicle", desc: "Bike, auto, sedan, or SUV options" },
];

export default function Index() {
  const { profile, user } = useAuth();

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-5" />
        <div className="container relative py-20 md:py-32">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-medium shadow-card animate-fade-in">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse-dot" />
              Now available in your city
            </div>
            <h1 className="mb-6 font-display text-4xl font-bold tracking-tight md:text-6xl animate-fade-in" style={{ animationDelay: "0.1s" }}>
              Your Ride,{" "}
              <span className="text-primary">Your Way</span>
            </h1>
            <p className="mb-10 text-lg text-muted-foreground animate-fade-in" style={{ animationDelay: "0.2s" }}>
              Book affordable rides instantly. Whether you're a passenger looking for a ride or a driver wanting to earn — RideShare connects you.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center animate-fade-in" style={{ animationDelay: "0.3s" }}>
              {user ? (
                profile ? (
                  <Link to={profile.role === "driver" ? "/driver" : "/search"}>
                    <Button size="lg" className="gradient-hero text-primary-foreground border-0 px-8 text-base shadow-elevated">
                      {profile.role === "driver" ? "Go to Dashboard" : "Find a Ride"}
                    </Button>
                  </Link>
                ) : (
                  <Button size="lg" disabled className="gradient-hero text-primary-foreground border-0 px-8 text-base shadow-elevated">
                    Checking profile...
                  </Button>
                )
              ) : (
                <Link to="/signup">
                  <Button size="lg" className="gradient-hero text-primary-foreground border-0 px-8 text-base shadow-elevated">
                    Get Started
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container">
          <h2 className="mb-12 text-center font-display text-3xl font-bold">
            Why <span className="text-primary">RideShare</span>?
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="group rounded-xl border bg-card p-6 shadow-card transition-all hover:shadow-elevated hover:-translate-y-1 animate-fade-in"
                style={{ animationDelay: `${0.1 * i}s` }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg gradient-hero">
                  <f.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container">
          <div className="mx-auto max-w-xl rounded-2xl gradient-hero p-10 text-center shadow-elevated">
            <h2 className="mb-4 font-display text-3xl font-bold text-primary-foreground">Ready to Ride?</h2>
            <p className="mb-6 text-primary-foreground/80">Join thousands of riders and drivers in your city.</p>
            <Link to="/signup">
              <Button size="lg" className="bg-card text-foreground hover:bg-card/90 border-0 px-8">
                Create Free Account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 font-display font-bold text-primary">
            <Car className="h-5 w-5" /> RideShare
          </div>
          <p className="text-sm text-muted-foreground">© 2026 RideShare. All rights reserved.</p>
        </div>
      </footer>
    </Layout>
  );
}
