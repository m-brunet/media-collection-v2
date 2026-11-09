// The HTTP rule upkeep run by the application itself: no actor.
export interface MaintainHttpInternetAccessUseCase {
    execute(): Promise<void>;
}
