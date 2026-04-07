import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";

interface LocationAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export function LocationAutocomplete({ value, onChange, placeholder, className }: LocationAutocompleteProps) {
    const [query, setQuery] = useState(value);
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const debounceRef = useRef<NodeJS.Timeout>();

    useEffect(() => {
        if (value !== query) {
            setQuery(value);
        }
    }, [value]);

    const fetchPlaces = async (text: string) => {
        if (!text) {
            setResults([]);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
                    text
                )}&countrycodes=in&limit=5`,
                {
                    headers: {
                        'Accept-Language': 'en-US,en;q=0.9'
                    }
                }
            );
            const data = await res.json();
            setResults(data || []);
            setShowDropdown(true);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const text = e.target.value;
        setQuery(text);
        onChange(text);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchPlaces(text);
        }, 400);
    };

    const handleSelect = (feature: any) => {
        // Find main part and secondary part of the address for simpler display
        const parts = feature.display_name.split(',').map((p: string) => p.trim());
        const placeName = feature.display_name;
        
        setQuery(parts[0]); // Show mostly the specific primary name in input, or the full name
        // Better to use the full name for DB matching, so maybe we use parts[0] + ", " + parts[parts.length-1]?
        // Let's use the full display name for consistency, but if it's too long, maybe only first 2 parts?
        const shortName = parts.slice(0, 2).join(', ');
        setQuery(shortName);
        onChange(shortName);
        setShowDropdown(false);
    };

    return (
        <div className="relative w-full">
            <div className="flex items-center w-full">
                <Input
                    value={query}
                    onChange={handleInputChange}
                    onFocus={() => {
                        if (results.length > 0) setShowDropdown(true);
                    }}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    placeholder={placeholder}
                    className={className}
                />
                {loading && <Loader2 className="absolute right-3 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>

            {showDropdown && results.length > 0 && (
                <div className="absolute z-[100] mt-1 w-full rounded-md border bg-card text-card-foreground shadow-lg top-full left-0 max-h-60 overflow-y-auto">
                    {results.map((feature: any) => (
                        <div
                            key={feature.place_id}
                            className="flex items-center gap-2 cursor-pointer px-4 py-2 hover:bg-muted"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelect(feature);
                            }}
                        >
                            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex flex-col overflow-hidden">
                                <span className="truncate text-sm font-medium">{feature.display_name.split(',')[0]}</span>
                                <span className="truncate text-xs text-muted-foreground">
                                    {feature.display_name.split(',').slice(1).join(',').trim()}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
