import { createContext, useContext, useReducer, ReactNode, useCallback } from "react";

// Types
export type WizardStep = "source" | "secrets" | "cleaning" | "destination" | "launch";
export type StepStatus = "pending" | "in_progress" | "completed" | "error";
export type Platform = "lovable" | "bolt" | "v0" | "cursor" | "other";
export type HostingType = "vps" | "traditional";

export interface DetectedSecret {
  name: string;
  category: "ai" | "auth" | "email" | "payment" | "storage" | "database" | "realtime" | "search" | "other";
  value: string;
  newValue: string;
  action: "keep" | "replace" | "delete";
  detectedIn: string[];
}

export interface SourceData {
  platform: Platform;
  repoUrl: string;
  owner: string;
  repo: string;
  token: string;
  isValidated: boolean;
}

export interface SecretsData {
  detectedSecrets: DetectedSecret[];
  isScanned: boolean;
  isValidated: boolean;
}

export interface CleaningData {
  filesAnalyzed: number;
  filesCleaned: number;
  currentFile: string;
  logs: string[];
  sovereigntyScore: number;
  isComplete: boolean;
  fetchedFiles: Array<{ path: string; content: string }>;
  cleanedFiles: Record<string, string>;
}

export interface DestinationData {
  hostingType: HostingType;
  // VPS fields
  vpsIp: string;
  setupId: string;
  coolifyToken: string;
  coolifyUrl: string;
  isVpsReady: boolean;
  // Traditional host fields
  ftpHost: string;
  ftpUser: string;
  ftpPassword: string;
  isFtpValidated: boolean;
  // Supabase migration (optional)
  migrateSupabase: boolean;
  sourceSupabaseUrl: string;
  sourceSupabaseKey: string;
  destSupabaseUrl: string;
  destSupabaseKey: string;
  isSupabaseMigrated: boolean;
  // GitHub destination
  destinationToken: string;
  destinationUsername: string;
  destinationRepo: string;
  isGithubValidated: boolean;
}

export interface LaunchData {
  isDeploying: boolean;
  progress: number;
  logs: string[];
  deployedUrl: string | null;
  isComplete: boolean;
}

export interface WizardState {
  currentStep: WizardStep;
  stepStatuses: Record<WizardStep, StepStatus>;
  source: SourceData;
  secrets: SecretsData;
  cleaning: CleaningData;
  destination: DestinationData;
  launch: LaunchData;
}

// Actions
type WizardAction =
  | { type: "SET_STEP"; payload: WizardStep }
  | { type: "SET_STEP_STATUS"; payload: { step: WizardStep; status: StepStatus } }
  | { type: "UPDATE_SOURCE"; payload: Partial<SourceData> }
  | { type: "UPDATE_SECRETS"; payload: Partial<SecretsData> }
  | { type: "UPDATE_SECRET_ITEM"; payload: { index: number; updates: Partial<DetectedSecret> } }
  | { type: "UPDATE_CLEANING"; payload: Partial<CleaningData> }
  | { type: "ADD_CLEANING_LOG"; payload: string }
  | { type: "UPDATE_DESTINATION"; payload: Partial<DestinationData> }
  | { type: "UPDATE_LAUNCH"; payload: Partial<LaunchData> }
  | { type: "ADD_LAUNCH_LOG"; payload: string }
  | { type: "RESET" };

// Initial state
const initialState: WizardState = {
  currentStep: "source",
  stepStatuses: {
    source: "pending",
    secrets: "pending",
    cleaning: "pending",
    destination: "pending",
    launch: "pending",
  },
  source: {
    platform: "lovable",
    repoUrl: "",
    owner: "",
    repo: "",
    token: "",
    isValidated: false,
  },
  secrets: {
    detectedSecrets: [],
    isScanned: false,
    isValidated: false,
  },
  cleaning: {
    filesAnalyzed: 0,
    filesCleaned: 0,
    currentFile: "",
    logs: [],
    sovereigntyScore: 0,
    isComplete: false,
    fetchedFiles: [],
    cleanedFiles: {},
  },
  destination: {
    hostingType: "vps",
    vpsIp: "",
    setupId: "",
    coolifyToken: "",
    coolifyUrl: "",
    isVpsReady: false,
    ftpHost: "",
    ftpUser: "",
    ftpPassword: "",
    isFtpValidated: false,
    migrateSupabase: false,
    sourceSupabaseUrl: "",
    sourceSupabaseKey: "",
    destSupabaseUrl: "",
    destSupabaseKey: "",
    isSupabaseMigrated: false,
    destinationToken: "",
    destinationUsername: "",
    destinationRepo: "",
    isGithubValidated: false,
  },
  launch: {
    isDeploying: false,
    progress: 0,
    logs: [],
    deployedUrl: null,
    isComplete: false,
  },
};

// Reducer
function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.payload };
    
    case "SET_STEP_STATUS":
      return {
        ...state,
        stepStatuses: {
          ...state.stepStatuses,
          [action.payload.step]: action.payload.status,
        },
      };
    
    case "UPDATE_SOURCE":
      return {
        ...state,
        source: { ...state.source, ...action.payload },
      };
    
    case "UPDATE_SECRETS":
      return {
        ...state,
        secrets: { ...state.secrets, ...action.payload },
      };
    
    case "UPDATE_SECRET_ITEM":
      return {
        ...state,
        secrets: {
          ...state.secrets,
          detectedSecrets: state.secrets.detectedSecrets.map((secret, idx) =>
            idx === action.payload.index
              ? { ...secret, ...action.payload.updates }
              : secret
          ),
        },
      };
    
    case "UPDATE_CLEANING":
      return {
        ...state,
        cleaning: { ...state.cleaning, ...action.payload },
      };
    
    case "ADD_CLEANING_LOG":
      return {
        ...state,
        cleaning: {
          ...state.cleaning,
          logs: [...state.cleaning.logs, action.payload],
        },
      };
    
    case "UPDATE_DESTINATION":
      return {
        ...state,
        destination: { ...state.destination, ...action.payload },
      };
    
    case "UPDATE_LAUNCH":
      return {
        ...state,
        launch: { ...state.launch, ...action.payload },
      };
    
    case "ADD_LAUNCH_LOG":
      return {
        ...state,
        launch: {
          ...state.launch,
          logs: [...state.launch.logs, action.payload],
        },
      };
    
    case "RESET":
      return initialState;
    
    default:
      return state;
  }
}

// Context
interface WizardContextType {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  goToStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  canGoNext: () => boolean;
  canGoPrev: () => boolean;
  getStepNumber: (step: WizardStep) => number;
  reset: () => void;
}

const WizardContext = createContext<WizardContextType | null>(null);

const stepOrder: WizardStep[] = ["source", "secrets", "cleaning", "destination", "launch"];

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  const goToStep = useCallback((step: WizardStep) => {
    dispatch({ type: "SET_STEP", payload: step });
  }, []);

  const getStepNumber = useCallback((step: WizardStep) => {
    return stepOrder.indexOf(step) + 1;
  }, []);

  const nextStep = useCallback(() => {
    const currentIndex = stepOrder.indexOf(state.currentStep);
    if (currentIndex < stepOrder.length - 1) {
      goToStep(stepOrder[currentIndex + 1]);
    }
  }, [state.currentStep, goToStep]);

  const prevStep = useCallback(() => {
    const currentIndex = stepOrder.indexOf(state.currentStep);
    if (currentIndex > 0) {
      goToStep(stepOrder[currentIndex - 1]);
    }
  }, [state.currentStep, goToStep]);

  const canGoNext = useCallback(() => {
    const currentIndex = stepOrder.indexOf(state.currentStep);
    return currentIndex < stepOrder.length - 1;
  }, [state.currentStep]);

  const canGoPrev = useCallback(() => {
    const currentIndex = stepOrder.indexOf(state.currentStep);
    return currentIndex > 0;
  }, [state.currentStep]);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return (
    <WizardContext.Provider
      value={{
        state,
        dispatch,
        goToStep,
        nextStep,
        prevStep,
        canGoNext,
        canGoPrev,
        getStepNumber,
        reset,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error("useWizard must be used within a WizardProvider");
  }
  return context;
}
