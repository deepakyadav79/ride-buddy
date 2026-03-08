import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, User, Truck } from "lucide-react";
import { toast } from "sonner";

export default function Signup() {
  const [role, setRole] = useState<"passenger" | "driver">("passenger");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, {
        role,
        full_name: fullName,
        phone,
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber,
      });
      toast.success("Account created! Check your email to confirm.");
      navigate("/login");
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-md shadow-elevated animate-fade-in">
        <CardHeader className="text-center">
          <Link to="/" className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl gradient-hero">
            <Car className="h-6 w-6 text-primary-foreground" />
          </Link>
          <CardTitle className="font-display text-2xl">Create Account</CardTitle>
          <CardDescription>Join RideShare as a passenger or driver</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Role selector */}
          <div className="mb-6 flex gap-3">
            <button
              type="button"
              onClick={() => setRole("passenger")}
              className={`flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                role === "passenger" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <User className={`h-6 w-6 ${role === "passenger" ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-sm font-medium ${role === "passenger" ? "text-primary" : "text-muted-foreground"}`}>Passenger</span>
            </button>
            <button
              type="button"
              onClick={() => setRole("driver")}
              className={`flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                role === "driver" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <Truck className={`h-6 w-6 ${role === "driver" ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-sm font-medium ${role === "driver" ? "text-primary" : "text-muted-foreground"}`}>Driver</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" required />
            </div>

            {role === "driver" && (
              <>
                <div className="space-y-2">
                  <Label>Vehicle Type</Label>
                  <Input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="e.g. Sedan, Bike, Auto" required />
                </div>
                <div className="space-y-2">
                  <Label>Vehicle Number</Label>
                  <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="e.g. KA01AB1234" required />
                </div>
              </>
            )}

            <Button type="submit" className="w-full gradient-hero text-primary-foreground border-0" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
