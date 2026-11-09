// The upkeep run by the application itself: no actor.
export interface MaintainInternetAccessUseCase {
    execute(): Promise<void>;
}
