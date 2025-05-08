
'use client';

import React, { useState, useTransition, useEffect, useRef } from 'react';
import Image from 'next/image'; // Import next/image
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form'; // Added Controller
import { z } from 'zod';
import { Loader2, Sparkles, Stethoscope, Leaf, Utensils, Bookmark, Trash2, Info, User, Pill, ScanLine, Camera, Upload, FileText } from 'lucide-react'; // Added ScanLine, Camera, Upload, FileText

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { identifySymptoms } from '@/ai/flows/identify-symptoms';
import { suggestRemediesAndDiet } from '@/ai/flows/suggest-remedies-and-diet';
import { suggestMedicines } from '@/ai/flows/suggest-medicines';
import { analyzePrescription, type AnalyzePrescriptionOutput } from '@/ai/flows/analyze-prescription-flow'; // Removed AnalyzePrescriptionOutputSchema import
import { useToast } from "@/hooks/use-toast";
import BottomNav from '@/components/BottomNav';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Import Table components

// ----- Zod Schemas -----
const SymptomFormSchema = z.object({
  symptoms: z.string().min(10, {
    message: 'Please describe your symptoms in at least 10 characters.',
  }),
});

const ProfileFormSchema = z.object({
  name: z.string().min(1, { message: "Name is required."}),
  age: z.coerce.number().min(1, { message: "Age must be positive."}).max(120, { message: "Age seems unlikely."}),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"], {
      required_error: "Please select a gender option."
  }),
  conditions: z.string().optional(),
});


// ----- Type Definitions -----
type SymptomFormData = z.infer<typeof SymptomFormSchema>;
type ProfileFormData = z.infer<typeof ProfileFormSchema>;

interface HealthInfo {
  conditions: string;
  remedies: string;
  diet: string;
}

interface SavedItem {
  id: string;
  condition: string;
  remedies?: string;
  diet?: string;
  timestamp: number;
}

interface MedicineInfo {
    suggestions: string;
    disclaimer: string;
}

interface UserProfile extends ProfileFormData {}

// Added 'scan' view
type ActiveView = 'home' | 'saved' | 'meds' | 'profile' | 'scan';


// ----- Component -----
export default function Home() {
  const [isPending, startTransition] = useTransition();
  const [isProfilePending, startProfileTransition] = useTransition();
  const [isMedicinePending, startMedicineTransition] = useTransition();
  const [isAnalyzingPrescription, startAnalyzingPrescriptionTransition] = useTransition(); // Added for prescription analysis
  const [healthInfo, setHealthInfo] = useState<HealthInfo | null>(null);
  const [medicineInfo, setMedicineInfo] = useState<MedicineInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [lastIdentifiedCondition, setLastIdentifiedCondition] = useState<string | null>(null);

  // State for scanning feature
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [prescriptionAnalysis, setPrescriptionAnalysis] = useState<AnalyzePrescriptionOutput | null>(null); // Use the updated type
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null); // To hold the stream for stopping later

  const { toast } = useToast();

  // Forms
  const symptomForm = useForm<SymptomFormData>({
    resolver: zodResolver(SymptomFormSchema),
    defaultValues: {
      symptoms: '',
    },
  });

  const profileForm = useForm<ProfileFormData>({
      resolver: zodResolver(ProfileFormSchema),
      defaultValues: {
        name: '',
        age: undefined,
        gender: undefined,
        conditions: '',
      },
    });

  // ----- Effects for localStorage -----
  useEffect(() => {
    try {
      const storedItems = localStorage.getItem('healthWiseSavedItems');
      if (storedItems) setSavedItems(JSON.parse(storedItems));
    } catch (e) { console.error("Failed to load saved items", e); }

    try {
        const storedProfile = localStorage.getItem('healthWiseUserProfile');
        if (storedProfile) {
            const parsedProfile = JSON.parse(storedProfile);
            setUserProfile(parsedProfile);
            profileForm.reset(parsedProfile);
        }
    } catch (e) { console.error("Failed to load profile", e); }
  }, [profileForm]);

  useEffect(() => {
    try {
      if (savedItems.length > 0) {
        localStorage.setItem('healthWiseSavedItems', JSON.stringify(savedItems));
      } else {
        localStorage.removeItem('healthWiseSavedItems');
      }
    } catch (e) { console.error("Failed to save items", e); }
  }, [savedItems]);

  useEffect(() => {
    try {
        if (userProfile) {
            localStorage.setItem('healthWiseUserProfile', JSON.stringify(userProfile));
        } else {
             localStorage.removeItem('healthWiseUserProfile');
        }
    } catch (e) { console.error("Failed to save profile", e); }
  }, [userProfile]);


  // Effect to handle 'meds' view change
   useEffect(() => {
    if (activeView === 'meds') {
        if (lastIdentifiedCondition) {
            fetchMedicineSuggestions(lastIdentifiedCondition);
        } else {
             setMedicineInfo(null);
        }
    } else {
         setMedicineInfo(null); // Clear medicine info when leaving meds view
    }
   }, [activeView, lastIdentifiedCondition]);


   // Effect for camera permission and cleanup
   useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); // Prefer rear camera
        setHasCameraPermission(true);
        streamRef.current = stream; // Store the stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to scan documents.',
        });
      }
    };

    // Only request permission if the scan view is active
    if (activeView === 'scan') {
      getCameraPermission();
      setCapturedImage(null); // Reset captured image when entering scan view
      setPrescriptionAnalysis(null); // Reset analysis when entering scan view
    }

    // Cleanup function to stop the camera stream
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (videoRef.current) {
          videoRef.current.srcObject = null; // Detach stream from video element
        }
        setHasCameraPermission(null); // Reset permission state
      }
    };
  }, [activeView, toast]); // Dependency array includes activeView


  // ----- API Call Functions -----
  async function onSubmitSymptoms(data: SymptomFormData) {
    setError(null);
    setHealthInfo(null);
    setMedicineInfo(null);
    setLastIdentifiedCondition(null);

    startTransition(async () => {
      try {
        const contextKeywords = userProfile ?
        `Symptoms: ${data.symptoms}. Profile context: Age ${userProfile.age}, Gender ${userProfile.gender}${userProfile.conditions ? `, Pre-existing conditions: ${userProfile.conditions}` : ''}.`
        : data.symptoms;


        const symptomsResult = await identifySymptoms({ keywords: contextKeywords });
        if (!symptomsResult || !symptomsResult.conditions) {
          throw new Error('Could not identify potential conditions. Please try rephrasing your symptoms.');
        }
        const identifiedCondition = symptomsResult.conditions;
        setLastIdentifiedCondition(identifiedCondition);

        const remediesDietResult = await suggestRemediesAndDiet({ healthCondition: identifiedCondition });
        if (!remediesDietResult || !remediesDietResult.homeRemedies || !remediesDietResult.dietSuggestions) {
           throw new Error('Could not fetch remedies and diet suggestions. Please try again.');
        }

        setHealthInfo({
          conditions: identifiedCondition,
          remedies: remediesDietResult.homeRemedies,
          diet: remediesDietResult.dietSuggestions,
        });

        toast({
          title: "Success!",
          description: "Health suggestions generated successfully.",
        });

      } catch (e: any) {
        console.error('Error during health check:', e);
        const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred. Please try again.';
        setError(errorMessage);
        toast({
          variant: "destructive",
          title: "Error",
          description: errorMessage,
        });
      }
    });
  }

  async function onSubmitProfile(data: ProfileFormData) {
     startProfileTransition(async () => {
        try {
            setUserProfile(data);
            toast({
                title: "Profile Saved",
                description: "Your profile information has been updated.",
            });
             setActiveView('home');

        } catch (e: any) {
            console.error("Error saving profile:", e);
            toast({
                variant: "destructive",
                title: "Save Error",
                description: "Could not save your profile. Please try again."
            });
        }
     });
  }

  async function fetchMedicineSuggestions(condition: string) {
    setMedicineInfo(null);
    startMedicineTransition(async () => {
        try {
            const result = await suggestMedicines({ healthCondition: condition });
            if (!result || !result.suggestedMedicines || !result.disclaimer) {
                throw new Error("Could not fetch medicine suggestions.");
            }
            setMedicineInfo({
                suggestions: result.suggestedMedicines,
                disclaimer: result.disclaimer,
            });
        } catch (e: any) {
             console.error("Error fetching medicine suggestions:", e);
            toast({
                variant: "destructive",
                title: "Medicine Suggestion Error",
                description: e.message || "Failed to load medicine suggestions."
            });
            setMedicineInfo({suggestions: "Error loading suggestions.", disclaimer: "Please consult a healthcare professional."});
        }
    });
  }

  // Function to process the captured/uploaded image
  async function handleProcessImage() {
    if (!capturedImage) {
      toast({ variant: "destructive", title: "No Image", description: "Please capture or upload an image first."});
      return;
    }
    setPrescriptionAnalysis(null);
    startAnalyzingPrescriptionTransition(async () => {
      try {
        const result = await analyzePrescription({ prescriptionImageDataUri: capturedImage });
        setPrescriptionAnalysis(result); // Set the structured result
        toast({ title: "Analysis Complete", description: result.summary || "Prescription analysis finished."});
      } catch (e: any) {
        console.error("Error analyzing prescription:", e);
        const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred during analysis.';
        // Set a default error structure matching AnalyzePrescriptionOutput
        const defaultDisclaimerText = '**Important Disclaimer:** This analysis is AI-generated and for informational purposes only. It is NOT a substitute for professional medical advice, diagnosis, or treatment. ALWAYS consult with a qualified healthcare provider or pharmacist regarding any medical condition or treatment. Do not disregard professional medical advice or delay in seeking it because of something you have read or interpreted from this AI-generated analysis. Reliance on any information provided by this AI is solely at your own risk.';
        setPrescriptionAnalysis({
            medications: [],
            summary: `Analysis Error: ${errorMessage}`,
            disclaimer: defaultDisclaimerText,
        });
        toast({
            variant: "destructive",
            title: "Analysis Error",
            description: errorMessage
        });
      }
    });
  }


  // ----- Helper Functions -----
  const saveCurrentInfo = () => {
    if (!healthInfo) return;
    const newItem: SavedItem = {
      id: Date.now().toString(),
      condition: healthInfo.conditions,
      remedies: healthInfo.remedies,
      diet: healthInfo.diet,
      timestamp: Date.now(),
    };
    const isDuplicate = savedItems.some(item => item.condition === newItem.condition && item.remedies === newItem.remedies && item.diet === newItem.diet);
    if (isDuplicate) {
      toast({ variant: "destructive", title: "Already Saved", description: "These suggestions are already saved." });
      return;
    }
    setSavedItems(prevItems => [newItem, ...prevItems]);
    toast({ title: "Saved!", description: "Health suggestions saved." });
  };

  const removeSavedItem = (idToRemove: string) => {
    setSavedItems(prevItems => prevItems.filter(item => item.id !== idToRemove));
    toast({ title: "Removed", description: "Saved item removed." });
  };

  // Function to capture image from video stream
  const captureImage = () => {
    if (videoRef.current && canvasRef.current && hasCameraPermission) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUri = canvas.toDataURL('image/png');
        setCapturedImage(dataUri);
        setPrescriptionAnalysis(null); // Clear previous analysis on new capture
        toast({ title: "Image Captured", description: "Document scan captured successfully." });
      }
    } else {
        toast({ variant: "destructive", title: "Capture Error", description: "Could not capture image. Ensure camera access is enabled." });
    }
  };

  // Function to handle file input change (alternative to camera)
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setCapturedImage(reader.result as string);
            setPrescriptionAnalysis(null); // Clear previous analysis on new upload
            toast({ title: "Image Uploaded", description: "Document uploaded successfully." });
        }
        reader.readAsDataURL(file);
    }
  };

  const resetScanView = () => {
    setCapturedImage(null);
    setPrescriptionAnalysis(null);
  }


  // ----- Render Logic -----
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <main className="flex-grow flex flex-col items-center p-6 md:p-12 pb-24">
        <div className="w-full max-w-3xl space-y-8">
          {/* Header */}
           <header className="text-center mb-8 relative overflow-hidden rounded-lg shadow-md">
              <Image
                src="https://picsum.photos/seed/healthcaretech/1000/200"
                alt="Abstract healthcare technology background"
                width={1000}
                height={200}
                className="w-full h-32 md:h-48 object-cover opacity-70"
                data-ai-hint="healthcare technology abstract medical"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent flex flex-col justify-end items-center p-4">
                 <h1 className="text-3xl md:text-4xl font-bold text-primary flex items-center justify-center gap-2">
                    <Stethoscope className="w-8 h-8 text-primary" />
                   Medibot-AI
                 </h1>
                 <p className="mt-1 text-muted-foreground">
                   AI care at your fingertips. {userProfile ? `Welcome back, ${userProfile.name}!` : 'Create a profile for personalized experience!'}
                </p>
              </div>
          </header>

          {/* ----- View Rendering ----- */}

          {/* Home View */}
          {activeView === 'home' && (
            <>
              <Card className="shadow-md bg-card text-card-foreground">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2 text-primary">
                    <Sparkles className="w-5 h-5 text-accent" />
                    Describe Your Symptoms
                  </CardTitle>
                   <CardDescription className="text-muted-foreground">
                        Enter your symptoms below. {userProfile ? 'Your saved profile details will be considered.' : 'Creating a profile can help tailor suggestions.'}
                   </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...symptomForm}>
                    <form onSubmit={symptomForm.handleSubmit(onSubmitSymptoms)} className="space-y-6">
                      <FormField
                        control={symptomForm.control}
                        name="symptoms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground">Symptoms Description</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="e.g., persistent headache, feeling tired, sore throat..."
                                className="resize-none bg-input text-foreground border-border"
                                rows={4}
                                {...field}
                                aria-label="Symptom Description Input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       {error && (
                        <Alert variant="destructive">
                           <Info className="h-4 w-4" />
                          <AlertTitle>Error</AlertTitle>
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}
                      <Button type="submit" disabled={isPending} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        {isPending ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</> ) : 'Get Health Suggestions'}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {isPending && ( <div className="flex justify-center items-center py-6"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2 text-muted-foreground">Generating suggestions...</p> </div> )}

              {healthInfo && !isPending && (
                <div className="space-y-6 mt-6">
                   <Card className="shadow-md bg-card text-card-foreground">
                     <CardHeader>
                      <CardTitle className="text-xl flex items-center justify-between gap-2">
                         <div className="flex items-center gap-2 text-primary"> <Stethoscope className="w-5 h-5 text-primary" /> Potential Condition(s) </div>
                        <Button variant="ghost" size="icon" onClick={saveCurrentInfo} title="Save Suggestions"> <Bookmark className="w-5 h-5 text-primary hover:fill-primary" /> <span className="sr-only">Save</span> </Button>
                      </CardTitle>
                       <CardDescription className="text-xs text-muted-foreground pt-1 italic"> *Disclaimer: This is AI-generated information and not a substitute for professional medical advice. Always consult a qualified healthcare provider for diagnosis and treatment. </CardDescription>
                    </CardHeader>
                    <CardContent> <p className="text-foreground whitespace-pre-wrap">{healthInfo.conditions}</p> </CardContent>
                  </Card>
                   <Card className="shadow-md bg-card text-card-foreground">
                     <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2 text-accent"> <Leaf className="w-5 h-5 text-accent" /> Suggested Home Remedies </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground pt-1 italic"> *Disclaimer: These are general suggestions. Effectiveness varies. Consult a professional before trying home remedies, especially if you have underlying health conditions. </CardDescription>
                    </CardHeader>
                     <CardContent> <p className="text-foreground whitespace-pre-wrap">{healthInfo.remedies}</p> </CardContent>
                  </Card>
                  <Card className="shadow-md bg-card text-card-foreground">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2 text-accent"> <Utensils className="w-5 h-5 text-accent" /> Diet Suggestions </CardTitle>
                         <CardDescription className="text-xs text-muted-foreground pt-1 italic"> *Disclaimer: Dietary needs are individual. This is a general suggestion, not a personalized plan. Consult a doctor or registered dietitian for specific advice. </CardDescription>
                    </CardHeader>
                    <CardContent> <p className="text-foreground whitespace-pre-wrap">{healthInfo.diet}</p> </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}

          {/* Saved Suggestions View */}
          {activeView === 'saved' && (
             <Card className="shadow-md bg-card text-card-foreground">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2 text-primary">
                  <Bookmark className="w-5 h-5 text-primary fill-primary" /> Saved Suggestions
                </CardTitle>
                 <CardDescription className="text-muted-foreground">Your saved health suggestions are listed here.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  {savedItems.length > 0 ? (
                      savedItems.map((item) => (
                          <Card key={item.id} className="bg-muted/30 border border-border">
                              <CardHeader className="pb-2 pt-4">
                                  <div className="flex justify-between items-start">
                                      <CardTitle className="text-lg font-semibold text-primary">{item.condition}</CardTitle>
                                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10 -mt-2 -mr-2" onClick={() => removeSavedItem(item.id)} title="Remove"> <Trash2 className="w-4 h-4" /> <span className="sr-only">Remove</span> </Button>
                                  </div>
                                  <p className="text-xs text-muted-foreground">Saved: {new Date(item.timestamp).toLocaleDateString()}</p>
                              </CardHeader>
                              <CardContent className="text-sm space-y-3 pt-2 pb-4 text-foreground">
                                  {item.remedies && ( <div> <h4 className="font-medium text-accent flex items-center gap-1.5 mb-1"><Leaf size={14} /> Remedies:</h4> <p className="whitespace-pre-wrap text-foreground/90 pl-1">{item.remedies}</p> </div> )}
                                   {item.diet && ( <div> <h4 className="font-medium text-accent flex items-center gap-1.5 mb-1"><Utensils size={14} /> Diet:</h4> <p className="whitespace-pre-wrap text-foreground/90 pl-1">{item.diet}</p> </div> )}
                              </CardContent>
                          </Card>
                      ))
                  ) : ( <p className="text-muted-foreground text-center py-4">No saved suggestions yet.</p> )}
              </CardContent>
            </Card>
          )}


           {/* Meds View */}
           {activeView === 'meds' && (
               <Card className="bg-card text-card-foreground shadow-md">
                 <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2 text-primary">
                        <Pill className="w-5 h-5 text-primary" /> OTC Medicine Suggestions
                    </CardTitle>
                     <CardDescription className="text-muted-foreground">Potential over-the-counter options based on the last identified condition.</CardDescription>
                 </CardHeader>
                 <CardContent>
                     {!lastIdentifiedCondition && !isMedicinePending && (
                        <Alert variant="default" className="bg-background border border-border text-foreground">
                           <Info className="h-4 w-4" />
                          <AlertTitle>Describe Symptoms First</AlertTitle>
                          <AlertDescription>
                             Go to the Home screen, describe your symptoms to get potential conditions, then return here for medicine suggestions.
                          </AlertDescription>
                        </Alert>
                      )}
                      {isMedicinePending && (
                        <div className="flex justify-center items-center py-6">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <p className="ml-2 text-muted-foreground">Loading suggestions...</p>
                        </div>
                    )}
                     {medicineInfo && !isMedicinePending && (
                        <div className="space-y-4">
                             <Alert variant={medicineInfo.suggestions.toLowerCase().includes("error") || medicineInfo.suggestions.toLowerCase().includes("could not generate") ? "destructive" : "default"} className={medicineInfo.suggestions.toLowerCase().includes("error") || medicineInfo.suggestions.toLowerCase().includes("could not generate") ? "" : "bg-background border border-border text-foreground"}>
                               <Pill className="h-4 w-4" />
                                <AlertTitle>Suggested OTC Medicines for: <span className="font-semibold text-primary">{lastIdentifiedCondition || "your condition"}</span></AlertTitle>
                                <AlertDescription className="whitespace-pre-wrap pt-2 text-foreground/90">
                                    {medicineInfo.suggestions}
                                </AlertDescription>
                            </Alert>
                            <Alert variant="destructive" className="mt-4">
                                <Info className="h-4 w-4"/>
                                <AlertTitle>Important Disclaimer</AlertTitle>
                                <AlertDescription className="whitespace-pre-wrap text-destructive-foreground/90">
                                    {medicineInfo.disclaimer}
                                </AlertDescription>
                            </Alert>
                        </div>
                     )}
                 </CardContent>
              </Card>
           )}

           {/* Profile View */}
            {activeView === 'profile' && (
            <Card className="shadow-md bg-card text-card-foreground">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2 text-primary">
                  <User className="w-5 h-5 text-primary" /> User Profile
                </CardTitle>
                <CardDescription className="text-muted-foreground">Enter your basic details for a better experience and more personalized suggestions.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(onSubmitProfile)} className="space-y-6">
                    <FormField
                      control={profileForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Alex Turing" {...field} aria-label="Name Input" className="bg-input text-foreground border-border" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="age"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Age</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="e.g., 30"
                              {...field}
                              onChange={event => {
                                const value = event.target.value;
                                field.onChange(value === '' ? undefined : +value);
                              }}
                              value={field.value ?? ''} // Ensure value is never null/undefined for input type=number
                              aria-label="Age Input"
                              className="bg-input text-foreground border-border"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel className="text-foreground">Gender</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="flex flex-col space-y-1 md:flex-row md:space-y-0 md:space-x-4"
                              aria-label="Gender Selection"
                            >
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="male" />
                                </FormControl>
                                <FormLabel className="font-normal text-foreground">Male</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="female" />
                                </FormControl>
                                <FormLabel className="font-normal text-foreground">Female</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="other" />
                                </FormControl>
                                <FormLabel className="font-normal text-foreground">Other</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="prefer_not_to_say" />
                                </FormControl>
                                <FormLabel className="font-normal text-foreground">Prefer not to say</FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="conditions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Pre-existing Conditions (Optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="e.g., Diabetes, Asthma, High Blood Pressure" className="resize-none bg-input text-foreground border-border" rows={3} {...field} aria-label="Pre-existing Conditions Input" />
                          </FormControl>
                          <FormDescription className="text-muted-foreground">Listing conditions can help provide more relevant context for symptom analysis.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={isProfilePending} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                      {isProfilePending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : (userProfile ? 'Update Profile' : 'Save Profile')}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
            )}

           {/* Scan View */}
           {activeView === 'scan' && (
             <Card className="bg-card text-card-foreground shadow-md">
                 <CardHeader>
                     <CardTitle className="text-xl flex items-center gap-2 text-primary">
                         <ScanLine className="w-5 h-5 text-primary" /> Scan Document
                     </CardTitle>
                     <CardDescription className="text-muted-foreground">
                         Scan a prescription or test report using your camera, or upload an image. The AI will try to analyze it.
                     </CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-4">
                     {/* Hidden canvas for capturing frame */}
                     <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

                     {/* Video Preview Area */}
                     {!capturedImage && (
                        <div className="relative aspect-video w-full bg-muted rounded-md overflow-hidden border border-border">
                            <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                            {hasCameraPermission === false && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-destructive-foreground p-4 text-center">
                                    <Camera className="w-12 h-12 mb-4"/>
                                    <p className="font-semibold">Camera Access Denied</p>
                                    <p className="text-sm">Please enable camera permissions in your browser settings.</p>
                                </div>
                            )}
                            {hasCameraPermission === null && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                  <Loader2 className="w-8 h-8 animate-spin text-primary"/>
                                </div>
                            )}
                        </div>
                     )}


                     {/* Action Buttons */}
                     {!capturedImage && (
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button onClick={captureImage} disabled={!hasCameraPermission} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                                <Camera className="mr-2 h-4 w-4"/>
                                Capture Image
                            </Button>
                            <Button asChild variant="outline" className="flex-1">
                              <label className="cursor-pointer flex items-center justify-center"> {/* Ensure label takes full button space and centers content */}
                                  <Upload className="mr-2 h-4 w-4"/> Upload Image
                                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden"/>
                              </label>
                            </Button>
                        </div>
                     )}


                     {/* Display Captured/Uploaded Image & Analysis */}
                     {capturedImage && (
                         <div className="mt-4 border border-border rounded-md p-4 space-y-4">
                             <div>
                                 <p className="text-sm font-medium text-muted-foreground mb-2">Preview:</p>
                                 <Image
                                    src={capturedImage}
                                    alt="Captured document"
                                    width={400}
                                    height={300}
                                    className="rounded-md object-contain max-h-60 w-auto mx-auto border border-border"
                                 />
                             </div>

                             <div className="flex flex-col sm:flex-row gap-2">
                                <Button onClick={handleProcessImage} disabled={isAnalyzingPrescription} className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground">
                                    {isAnalyzingPrescription ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Analyzing...</> : <><FileText className="mr-2 h-4 w-4"/>Analyze Prescription</>}
                                </Button>
                                <Button variant="ghost" onClick={resetScanView} className="text-destructive hover:text-destructive">
                                     <Trash2 className="mr-1 h-3 w-3"/> Retake/Remove Image
                                </Button>
                             </div>
                         </div>
                     )}

                     {isAnalyzingPrescription && (
                        <div className="flex justify-center items-center py-6">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <p className="ml-2 text-muted-foreground">Analyzing prescription, please wait...</p>
                        </div>
                     )}

                     {/* Updated Prescription Analysis Display */}
                     {prescriptionAnalysis && !isAnalyzingPrescription && (
                         <Card className="mt-4 bg-muted/30 border-border">
                             <CardHeader>
                                 <CardTitle className="text-lg flex items-center gap-2 text-primary">
                                     <FileText className="w-5 h-5 text-primary"/> Prescription Analysis
                                 </CardTitle>
                                 <CardDescription className="text-muted-foreground pt-1">{prescriptionAnalysis.summary}</CardDescription>
                             </CardHeader>
                             <CardContent className="space-y-4">
                                 {/* Display Medications Table */}
                                 {prescriptionAnalysis.medications && prescriptionAnalysis.medications.length > 0 ? (
                                     <div className="overflow-x-auto">
                                         <Table>
                                             <TableHeader>
                                                 <TableRow>
                                                     <TableHead>Medication</TableHead>
                                                     <TableHead>Dosage</TableHead>
                                                     <TableHead>Frequency</TableHead>
                                                     <TableHead>Duration</TableHead>
                                                     <TableHead>Notes</TableHead>
                                                 </TableRow>
                                             </TableHeader>
                                             <TableBody>
                                                 {prescriptionAnalysis.medications.map((med, index) => (
                                                     <TableRow key={index}>
                                                         <TableCell className="font-medium">{med.name}</TableCell>
                                                         <TableCell>{med.dosage}</TableCell>
                                                         <TableCell>{med.frequency || '-'}</TableCell>
                                                         <TableCell>{med.duration || '-'}</TableCell>
                                                         <TableCell>{med.notes || '-'}</TableCell>
                                                     </TableRow>
                                                 ))}
                                             </TableBody>
                                         </Table>
                                     </div>
                                 ) : (
                                     <Alert variant="default" className="bg-background border-border text-foreground">
                                         <Info className="h-4 w-4" />
                                         <AlertTitle>No Medications Found</AlertTitle>
                                         <AlertDescription>
                                            {prescriptionAnalysis.summary.includes("Error") || prescriptionAnalysis.summary.includes("failed") || prescriptionAnalysis.summary.includes("Could not analyze")
                                              ? "The AI could not extract medication details."
                                              : "No specific medications were identified in the analysis."}
                                         </AlertDescription>
                                     </Alert>
                                 )}

                                 {/* Display Overall Instructions */}
                                 {prescriptionAnalysis.overall_instructions && (
                                     <Alert variant="default" className="bg-background border-border text-foreground mt-4">
                                         <AlertTitle>Overall Instructions</AlertTitle>
                                         <AlertDescription className="whitespace-pre-wrap pt-2 text-foreground/90">
                                             {prescriptionAnalysis.overall_instructions}
                                         </AlertDescription>
                                     </Alert>
                                 )}

                                 {/* Display Disclaimer */}
                                 <Alert variant="destructive" className="mt-4">
                                     <Info className="h-4 w-4"/>
                                     <AlertTitle>Important Disclaimer</AlertTitle>
                                     <AlertDescription className="whitespace-pre-wrap text-destructive-foreground/90">
                                         {prescriptionAnalysis.disclaimer}
                                     </AlertDescription>
                                 </Alert>
                             </CardContent>
                         </Card>
                     )}


                     {/* Show alert if camera access is explicitly denied */}
                     {hasCameraPermission === false && activeView === 'scan' && !capturedImage && (
                         <Alert variant="destructive" className="mt-4">
                             <Camera className="h-4 w-4"/>
                             <AlertTitle>Camera Access Required</AlertTitle>
                             <AlertDescription>
                                 Camera access was denied or is unavailable. Please enable it in your browser settings to use the scan feature, or upload an image instead.
                             </AlertDescription>
                         </Alert>
                     )}

                 </CardContent>
             </Card>
            )}


        </div>
      </main>


      {/* Bottom Navigation */}
      <BottomNav activeView={activeView} setActiveView={setActiveView} />
    </div>
  );
}

