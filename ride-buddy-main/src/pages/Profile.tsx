import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Phone, Mail, Car, Plus, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [role, setRole] = useState<"passenger" | "driver">("passenger");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || user?.user_metadata?.full_name || "");
      setRole(profile.role || user?.user_metadata?.role || "passenger");
      setPhone(profile.phone || user?.user_metadata?.phone || "");
      setVehicleType(profile.vehicle_type || user?.user_metadata?.vehicle_type || "");
      setVehicleNumber(profile.vehicle_number || user?.user_metadata?.vehicle_number || "");
    } else if (user?.user_metadata) {
      // Fallback to metadata while profile is loading or if it's new
      setFullName(user.user_metadata.full_name || "");
      setRole(user.user_metadata.role || "passenger");
      setPhone(user.user_metadata.phone || "");
      setVehicleType(user.user_metadata.vehicle_type || "");
      setVehicleNumber(user.user_metadata.vehicle_number || "");
    }
  }, [profile, user]);

  useEffect(() => {
    if (!profile?.user_id) return;
    supabase
      .from("emergency_contacts")
      .select("*")
      .eq("user_id", profile.user_id)
      .then(({ data }) => setContacts((data || []) as EmergencyContact[]));
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    // We use upsert so that even if the profile record is missing, it gets created.
    // We use user.id as the primary key reference (through the user_id column).
    const { error } = await supabase
      .from("profiles")
      .upsert({
        user_id: user.id,
        full_name: fullName,
        email: user.email, // Ensure email is passed for completeness
        phone,
        role,
        vehicle_type: role === "driver" ? vehicleType : null,
        vehicle_number: role === "driver" ? vehicleNumber : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      console.error("Error saving profile:", error);
      toast.error(error.message || "Failed to save profile");
    } else {
      toast.success("Profile updated!");
      refreshProfile();
    }
    setSaving(false);
  };

  const addContact = async () => {
    if (!user || !newContactName || !newContactPhone) return;
    const { data, error } = await supabase
      .from("emergency_contacts")
      .insert({ user_id: user.id, name: newContactName, phone: newContactPhone })
      .select()
      .single();
    if (error) toast.error(error.message);
    else {
      setContacts([...contacts, data as EmergencyContact]);
      setNewContactName("");
      setNewContactPhone("");
      toast.success("Contact added");
    }
  };

  const removeContact = async (id: string) => {
    const { error } = await supabase.from("emergency_contacts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      setContacts(contacts.filter((c) => c.id !== id));
      toast.success("Contact removed");
    }
  };

  if (!user && !profile) return <Layout><div className="container py-16 text-center text-muted-foreground">Loading...</div></Layout>;

  return (
    <Layout>
      <div className="container max-w-2xl py-8">
        <h1 className="mb-8 font-display text-3xl font-bold">
          My <span className="text-primary">Profile</span>
        </h1>

        <Card className="mb-6 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <User className="h-5 w-5 text-primary" /> Personal Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Account Type</Label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={role === "passenger" ? "default" : "outline"}
                  onClick={() => setRole("passenger")}
                  className="flex-1"
                >
                  Passenger
                </Button>
                <Button
                  size="sm"
                  variant={role === "driver" ? "default" : "outline"}
                  onClick={() => setRole("driver")}
                  className="flex-1"
                >
                  Driver
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
              <Input value={profile?.email || user?.email || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
            </div>

            {role === "driver" && (
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Car className="h-3.5 w-3.5" /> Vehicle Type</Label>
                  <Input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="e.g. Sedan, SUV, Bike" />
                </div>
                <div className="space-y-2">
                  <Label>Vehicle Number</Label>
                  <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="e.g. KA01AB1234" />
                </div>
              </>
            )}

            <Button onClick={handleSave} disabled={saving} className="gradient-hero text-primary-foreground border-0 w-full mt-2">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        {/* Emergency Contacts Section */}
        <div className="mt-12 mb-4">
          <h2 className="font-display text-2xl font-bold">Safety & <span className="text-accent">Emergency</span></h2>
          <p className="text-sm text-muted-foreground mt-1">Manage contacts who should be notified in case of an emergency during your rides.</p>
        </div>

        <Card className="shadow-card border-t-4 border-t-accent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Shield className="h-5 w-5 text-accent" /> Registered Contacts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.phone}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeContact(c.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}

            <div className="flex gap-2">
              <Input value={newContactName} onChange={(e) => setNewContactName(e.target.value)} placeholder="Name" className="flex-1" />
              <Input value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} placeholder="Phone" className="flex-1" />
              <Button size="icon" onClick={addContact} className="gradient-hero text-primary-foreground border-0 shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
