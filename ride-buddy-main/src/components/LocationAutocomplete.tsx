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
            const MAPBOX_KEY = import.meta.env.VITE_MAPBOX_API_KEY;
            if (!MAPBOX_KEY) {
                console.warn("Mapbox API Key is missing");
                return;
            }
            const res = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
                    text
                )}.json?access_token=${MAPBOX_KEY}&autocomplete=true&types=place,locality,neighborhood,address,poi&country=in&limit=5`
            );
            const data = await res.json();
            setResults(data.features || []);
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
        const placeName = feature.place_name;
        setQuery(placeName);
        onChange(placeName);
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
                            key={feature.id}
                            className="flex items-center gap-2 cursor-pointer px-4 py-2 hover:bg-muted"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelect(feature);
                            }}
                        >
                            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex flex-col overflow-hidden">
                                <span className="truncate text-sm font-medium">{feature.text}</span>
                                <span className="truncate text-xs text-muted-foreground">
                                    {feature.place_name.substring(feature.text.length + 2)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
