import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Car, LogOut, User, Menu, X, Bell } from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "./NotificationBell";

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold text-primary">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-hero">
            <Car className="h-5 w-5 text-primary-foreground" />
          </div>
          RideShare
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <NotificationBell />
              {profile ? (
                <>
                  <Link to={profile.role === "driver" ? "/driver" : "/search"}>
                    <Button variant="ghost" size="sm">
                      {profile.role === "driver" ? "Dashboard" : "Find Rides"}
                    </Button>
                  </Link>
                  <Link to="/history">
                    <Button variant="ghost" size="sm">History</Button>
                  </Link>
                  <Link to="/profile">
                    <Button variant="ghost" size="sm" className="gap-2">
                      <User className="h-4 w-4" />
                      {profile.full_name || "Profile"}
                    </Button>
                  </Link>
                </>
              ) : (
                <Button variant="ghost" size="sm" disabled>Loading...</Button>
              )}
              <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">Login</Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" className="gradient-hero text-primary-foreground border-0">
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t bg-card p-4 md:hidden animate-fade-in">
          <div className="flex flex-col gap-2">
            {user ? (
              <>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm font-medium">Notifications</span>
                  <NotificationBell />
                </div>
                {profile ? (
                  <>
                    <Link to={profile.role === "driver" ? "/driver" : "/search"} onClick={() => setMobileOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start gap-2">
                        {profile.role === "driver" ? "Dashboard" : "Find Rides"}
                      </Button>
                    </Link>
                    <Link to="/history" onClick={() => setMobileOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start gap-2">History</Button>
                    </Link>
                    <Link to="/profile" onClick={() => setMobileOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start gap-2">Profile</Button>
                    </Link>
                  </>
                ) : (
                  <Button variant="ghost" className="w-full justify-start gap-2" disabled>Loading Profile...</Button>
                )}
                <Button variant="outline" onClick={handleSignOut} className="w-full justify-start gap-2">
                  <LogOut className="h-4 w-4" /> Logout
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full">Login</Button>
                </Link>
                <Link to="/signup" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full gradient-hero text-primary-foreground border-0">Sign Up</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
