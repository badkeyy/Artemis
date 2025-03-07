import { Component, ContentChild, OnDestroy, OnInit, TemplateRef } from '@angular/core';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import { filter, skip } from 'rxjs/operators';
import { Result } from 'app/entities/result.model';
import dayjs from 'dayjs/esm';
import { ParticipationService } from 'app/exercises/shared/participation/participation.service';
import { ParticipationWebsocketService } from 'app/overview/participation-websocket.service';
import { GuidedTourService } from 'app/guided-tour/guided-tour.service';
import { programmingExerciseFail, programmingExerciseSuccess } from 'app/guided-tour/tours/course-exercise-detail-tour';
import { ProfileService } from 'app/shared/layouts/profiles/profile.service';
import { Participation } from 'app/entities/participation/participation.model';
import { Exercise, ExerciseType, getIcon } from 'app/entities/exercise.model';
import { StudentParticipation } from 'app/entities/participation/student-participation.model';
import { ExampleSolutionInfo, ExerciseDetailsType, ExerciseService } from 'app/exercises/shared/exercise/exercise.service';
import { AssessmentType } from 'app/entities/assessment-type.model';
import { hasExerciseDueDatePassed } from 'app/exercises/shared/exercise/exercise.utils';
import { ProgrammingExercise } from 'app/entities/programming/programming-exercise.model';
import { GradingCriterion } from 'app/exercises/shared/structured-grading-criterion/grading-criterion.model';
import { AlertService } from 'app/core/util/alert.service';
import { TeamAssignmentPayload } from 'app/entities/team.model';
import { TeamService } from 'app/exercises/shared/team/team.service';
import { QuizExercise, QuizStatus } from 'app/entities/quiz/quiz-exercise.model';
import { QuizExerciseService } from 'app/exercises/quiz/manage/quiz-exercise.service';
import { ExerciseCategory } from 'app/entities/exercise-category.model';
import { getFirstResultWithComplaintFromResults } from 'app/entities/submission.model';
import { ComplaintService } from 'app/complaints/complaint.service';
import { Complaint } from 'app/entities/complaint.model';
import { SubmissionPolicy } from 'app/entities/submission-policy.model';
import { ArtemisMarkdownService } from 'app/shared/markdown.service';
import { IconDefinition, faAngleDown, faAngleUp, faBook, faEye, faFileSignature, faListAlt, faSignal, faTable, faWrench } from '@fortawesome/free-solid-svg-icons';
import { PlagiarismVerdict } from 'app/exercises/shared/plagiarism/types/PlagiarismVerdict';
import { PlagiarismCaseInfo } from 'app/exercises/shared/plagiarism/types/PlagiarismCaseInfo';
import { MAX_RESULT_HISTORY_LENGTH } from 'app/overview/result-history/result-history.component';
import { isCommunicationEnabled, isMessagingEnabled } from 'app/entities/course.model';
import { ExerciseCacheService } from 'app/exercises/shared/exercise/exercise-cache.service';
import { IrisSettings } from 'app/entities/iris/settings/iris-settings.model';
import { AbstractScienceComponent } from 'app/shared/science/science.component';
import { ScienceService } from 'app/shared/science/science.service';
import { ScienceEventType } from 'app/shared/science/science.model';
import { PROFILE_IRIS } from 'app/app.constants';
import { ChatServiceMode } from 'app/iris/iris-chat.service';
import { IconProp } from '@fortawesome/fontawesome-svg-core';

interface InstructorActionItem {
    routerLink: string;
    icon?: IconDefinition;
    translation: string;
}
@Component({
    selector: 'jhi-course-exercise-details',
    templateUrl: './course-exercise-details.component.html',
    styleUrls: ['../course-overview.scss', './course-exercise-details.component.scss'],
    providers: [ExerciseCacheService],
})
export class CourseExerciseDetailsComponent extends AbstractScienceComponent implements OnInit, OnDestroy {
    readonly AssessmentType = AssessmentType;
    readonly PlagiarismVerdict = PlagiarismVerdict;
    readonly QuizStatus = QuizStatus;
    readonly QUIZ_ENDED_STATUS: (QuizStatus | undefined)[] = [QuizStatus.CLOSED, QuizStatus.OPEN_FOR_PRACTICE];
    readonly QUIZ_EDITABLE_STATUS: (QuizStatus | undefined)[] = [QuizStatus.VISIBLE, QuizStatus.INVISIBLE];
    readonly QUIZ = ExerciseType.QUIZ;
    readonly PROGRAMMING = ExerciseType.PROGRAMMING;
    readonly MODELING = ExerciseType.MODELING;
    readonly TEXT = ExerciseType.TEXT;
    readonly FILE_UPLOAD = ExerciseType.FILE_UPLOAD;
    readonly dayjs = dayjs;
    readonly ChatServiceMode = ChatServiceMode;

    readonly isCommunicationEnabled = isCommunicationEnabled;
    readonly isMessagingEnabled = isMessagingEnabled;

    public learningPathMode = false;
    public exerciseId: number;
    public courseId: number;
    public exercise: Exercise;
    public resultWithComplaint?: Result;
    public latestRatedResult?: Result;
    public complaint?: Complaint;
    public showMoreResults = false;
    public sortedHistoryResults: Result[];
    public exerciseCategories: ExerciseCategory[];
    private participationUpdateListener: Subscription;
    private teamAssignmentUpdateListener: Subscription;
    private submissionSubscription: Subscription;
    studentParticipations: StudentParticipation[] = [];
    gradedStudentParticipation?: StudentParticipation;
    practiceStudentParticipation?: StudentParticipation;
    isAfterAssessmentDueDate: boolean;
    allowComplaintsForAutomaticAssessments: boolean;
    public gradingCriteria: GradingCriterion[];
    baseResource: string;
    isExamExercise: boolean;
    submissionPolicy?: SubmissionPolicy;
    exampleSolutionCollapsed: boolean;
    plagiarismCaseInfo?: PlagiarismCaseInfo;
    irisSettings?: IrisSettings;
    paramsSubscription: Subscription;
    profileSubscription?: Subscription;
    isProduction = true;
    isTestServer = false;
    isGeneratingFeedback: boolean = false;
    instructorActionItems: InstructorActionItem[] = [];
    exerciseIcon: IconProp;

    exampleSolutionInfo?: ExampleSolutionInfo;

    // extension points, see shared/extension-point
    @ContentChild('overrideStudentActions') overrideStudentActions: TemplateRef<any>;
    // Icons
    faBook = faBook;
    faEye = faEye;
    faWrench = faWrench;
    faTable = faTable;
    faListAlt = faListAlt;
    faAngleDown = faAngleDown;
    faAngleUp = faAngleUp;

    constructor(
        private exerciseService: ExerciseService,
        private participationWebsocketService: ParticipationWebsocketService,
        private participationService: ParticipationService,
        private route: ActivatedRoute,
        private profileService: ProfileService,
        private guidedTourService: GuidedTourService,
        private alertService: AlertService,
        private teamService: TeamService,
        private quizExerciseService: QuizExerciseService,
        private complaintService: ComplaintService,
        private artemisMarkdown: ArtemisMarkdownService,
        scienceService: ScienceService,
    ) {
        super(scienceService, ScienceEventType.EXERCISE__OPEN);
    }

    ngOnInit() {
        const courseIdParams$ = this.route.parent?.parent?.parent?.params;
        const exerciseIdParams$ = this.route.params;
        if (courseIdParams$) {
            this.paramsSubscription = combineLatest([courseIdParams$, exerciseIdParams$]).subscribe(([courseIdParams, exerciseIdParams]) => {
                const didExerciseChange = this.exerciseId !== parseInt(exerciseIdParams.exerciseId, 10);
                const didCourseChange = this.courseId !== parseInt(courseIdParams.courseId, 10);

                // if learningPathMode is enabled these attributes will be set by the parent
                if (!this.learningPathMode) {
                    this.exerciseId = parseInt(exerciseIdParams.exerciseId, 10);
                    this.courseId = parseInt(courseIdParams.courseId, 10);
                }
                if (didExerciseChange || didCourseChange) {
                    this.loadExercise();
                }

                // log event
                if (this.exerciseId) {
                    this.setResourceId(this.exerciseId);
                }
                this.logEvent();
            });
        }

        this.profileSubscription = this.profileService.getProfileInfo()?.subscribe((profileInfo) => {
            this.isProduction = profileInfo?.inProduction;
            this.isTestServer = profileInfo.testServer ?? false;
        });
    }

    loadExercise() {
        this.irisSettings = undefined;
        this.studentParticipations = this.participationWebsocketService.getParticipationsForExercise(this.exerciseId);
        this.updateStudentParticipations();
        this.resultWithComplaint = getFirstResultWithComplaintFromResults(this.gradedStudentParticipation?.results);
        this.exerciseService.getExerciseDetails(this.exerciseId).subscribe((exerciseResponse: HttpResponse<ExerciseDetailsType>) => {
            this.handleNewExercise(exerciseResponse.body!);
            this.loadComplaintAndLatestRatedResult();
        });
    }

    handleNewExercise(newExerciseDetails: ExerciseDetailsType) {
        this.exercise = newExerciseDetails.exercise;

        this.filterUnfinishedResults(this.exercise.studentParticipations);
        this.mergeResultsAndSubmissionsForParticipations();
        this.isAfterAssessmentDueDate = !this.exercise.assessmentDueDate || dayjs().isAfter(this.exercise.assessmentDueDate);
        this.exerciseCategories = this.exercise.categories ?? [];
        this.allowComplaintsForAutomaticAssessments = false;
        this.plagiarismCaseInfo = newExerciseDetails.plagiarismCaseInfo;
        if (this.exercise.type === ExerciseType.PROGRAMMING) {
            const programmingExercise = this.exercise as ProgrammingExercise;
            const isAfterDateForComplaint =
                !this.exercise.dueDate ||
                (hasExerciseDueDatePassed(this.exercise, this.gradedStudentParticipation) &&
                    (!programmingExercise.buildAndTestStudentSubmissionsAfterDueDate || dayjs().isAfter(programmingExercise.buildAndTestStudentSubmissionsAfterDueDate)));

            this.allowComplaintsForAutomaticAssessments = !!programmingExercise.allowComplaintsForAutomaticAssessments && isAfterDateForComplaint;
            this.submissionPolicy = programmingExercise.submissionPolicy;

            this.profileService.getProfileInfo().subscribe((profileInfo) => {
                if (profileInfo?.activeProfiles?.includes(PROFILE_IRIS)) {
                    this.irisSettings = newExerciseDetails.irisSettings;
                }
            });
        }

        this.showIfExampleSolutionPresent(newExerciseDetails.exercise);
        this.subscribeForNewResults();
        this.subscribeToTeamAssignmentUpdates();

        this.baseResource = `/course-management/${this.courseId}/${this.exercise.type}-exercises/${this.exercise.id}/`;
        if (this.exercise?.type) {
            this.exerciseIcon = getIcon(this.exercise?.type);
        }
        this.createInstructorActions();
    }

    /**
     * Sets example solution and related fields if exampleSolution exists on newExercise,
     * otherwise clears the previously set example solution related fields.
     *
     * @param newExercise Exercise model that may have an exampleSolution.
     */
    showIfExampleSolutionPresent(newExercise: Exercise) {
        this.exampleSolutionInfo = ExerciseService.extractExampleSolutionInfo(newExercise, this.artemisMarkdown);
        // For TAs the example solution is collapsed on default to avoid spoiling, as the example solution is always shown to TAs
        this.exampleSolutionCollapsed = !!newExercise?.isAtLeastTutor;
    }

    /**
     * Filters out any unfinished Results
     */
    private filterUnfinishedResults(participations?: StudentParticipation[]) {
        participations?.forEach((participation: Participation) => {
            if (participation.results) {
                participation.results = participation.results.filter((result: Result) => result.completionDate);
            }
        });
    }

    sortResults() {
        if (this.studentParticipations?.length) {
            this.studentParticipations.forEach((participation) => participation.results?.sort(this.resultSortFunction));
            this.sortedHistoryResults = this.studentParticipations
                .flatMap((participation) => participation.results ?? [])
                .sort(this.resultSortFunction)
                .filter((result) => !(result.assessmentType === AssessmentType.AUTOMATIC_ATHENA && !result.successful));
        }
    }

    private resultSortFunction = (a: Result, b: Result) => {
        const aValue = dayjs(a.completionDate!).valueOf();
        const bValue = dayjs(b.completionDate!).valueOf();
        return aValue - bValue;
    };

    mergeResultsAndSubmissionsForParticipations() {
        // if there are new student participation(s) from the server, we need to update this.studentParticipation
        if (this.exercise?.studentParticipations?.length) {
            this.studentParticipations = this.participationService.mergeStudentParticipations(this.exercise.studentParticipations);
            this.exercise.studentParticipations = this.studentParticipations;
            this.updateStudentParticipations();
            this.sortResults();
            // Add exercise to studentParticipation, as the result component is dependent on its existence.
            this.studentParticipations.forEach((participation) => (participation.exercise = this.exercise));
        } else if (this.studentParticipations?.length && this.exercise) {
            // otherwise we make sure that the student participation in exercise is correct
            this.exercise.studentParticipations = this.studentParticipations;
        }
    }

    subscribeForNewResults() {
        if (this.exercise && this.studentParticipations?.length) {
            this.studentParticipations.forEach((participation) => {
                this.participationWebsocketService.addParticipation(participation, this.exercise);
            });
            if (this.latestRatedResult) {
                if (this.latestRatedResult.successful) {
                    this.guidedTourService.enableTourForExercise(this.exercise, programmingExerciseSuccess, true);
                } else {
                    this.guidedTourService.enableTourForExercise(this.exercise, programmingExerciseFail, true);
                }
            }
        }

        this.participationUpdateListener?.unsubscribe();
        this.participationUpdateListener = this.participationWebsocketService
            .subscribeForParticipationChanges()
            // Skip the first event, as it is the initial state. All data should already be loaded.
            .pipe(skip(1))
            .subscribe((changedParticipation: StudentParticipation) => {
                if (changedParticipation && this.exercise && changedParticipation.exercise?.id === this.exercise.id) {
                    // Notify student about late submission result
                    if (
                        changedParticipation.exercise?.dueDate &&
                        hasExerciseDueDatePassed(changedParticipation.exercise, changedParticipation) &&
                        changedParticipation.id === this.gradedStudentParticipation?.id &&
                        (changedParticipation.results?.length || 0) > (this.gradedStudentParticipation?.results?.length || 0)
                    ) {
                        this.isGeneratingFeedback = false;
                        this.alertService.success('artemisApp.exercise.lateSubmissionResultReceived');
                    }
                    if (
                        ((changedParticipation.results?.length || 0) > (this.gradedStudentParticipation?.results?.length || 0) ||
                            changedParticipation.results?.last()?.completionDate === undefined) &&
                        changedParticipation.results?.last()?.assessmentType === AssessmentType.AUTOMATIC_ATHENA &&
                        changedParticipation.results?.last()?.successful !== undefined
                    ) {
                        this.isGeneratingFeedback = false;
                        if (changedParticipation.results?.last()?.successful === true) {
                            this.alertService.success('artemisApp.exercise.athenaFeedbackSuccessful');
                        } else {
                            this.alertService.error('artemisApp.exercise.athenaFeedbackFailed');
                        }
                    }
                    if (this.studentParticipations?.some((participation) => participation.id === changedParticipation.id)) {
                        this.exercise.studentParticipations = this.studentParticipations.map((participation) =>
                            participation.id === changedParticipation.id ? changedParticipation : participation,
                        );
                    } else {
                        this.exercise.studentParticipations = [...this.studentParticipations, changedParticipation];
                    }
                    this.updateStudentParticipations();
                    this.mergeResultsAndSubmissionsForParticipations();
                }
            });
    }

    private updateStudentParticipations() {
        this.gradedStudentParticipation = this.participationService.getSpecificStudentParticipation(this.studentParticipations, false);
        this.practiceStudentParticipation = this.participationService.getSpecificStudentParticipation(this.studentParticipations, true);
    }

    /**
     * Receives team assignment changes and applies them if they belong to this exercise
     */
    async subscribeToTeamAssignmentUpdates() {
        this.teamAssignmentUpdateListener = (await this.teamService.teamAssignmentUpdates)
            .pipe(filter(({ exerciseId }: TeamAssignmentPayload) => exerciseId === this.exercise?.id))
            .subscribe((teamAssignment) => {
                this.exercise!.studentAssignedTeamId = teamAssignment.teamId;
                this.exercise!.studentParticipations = teamAssignment.studentParticipations;
            });
    }

    exerciseRatedBadge(result: Result): string {
        return result.rated ? 'bg-success' : 'bg-info';
    }

    get hasMoreResults(): boolean {
        if (!this.studentParticipations?.length || !this.sortedHistoryResults.length) {
            return false;
        }
        return this.sortedHistoryResults.length > MAX_RESULT_HISTORY_LENGTH;
    }

    /**
     * Loads and stores the complaint if any exists. Furthermore, loads the latest rated result and stores it.
     */
    loadComplaintAndLatestRatedResult(): void {
        if (!this.gradedStudentParticipation?.submissions?.[0] || !this.sortedHistoryResults?.length) {
            return;
        }
        this.complaintService.findBySubmissionId(this.gradedStudentParticipation!.submissions![0].id!).subscribe({
            next: (res) => {
                if (!res.body) {
                    return;
                }
                this.complaint = res.body;
            },
            error: (err: HttpErrorResponse) => {
                this.onError(err.message);
            },
        });

        if (this.exercise!.type === ExerciseType.MODELING || this.exercise!.type === ExerciseType.TEXT) {
            return;
        }

        const ratedResults = this.gradedStudentParticipation?.results?.filter((result: Result) => result.rated).sort(this.resultSortFunction);
        if (ratedResults) {
            const latestResult = ratedResults.last();
            if (latestResult) {
                latestResult.participation = this.gradedStudentParticipation;
            }
            this.latestRatedResult = latestResult;
        }
    }

    /**
     * Returns the status of the exercise if it is a quiz exercise or undefined otherwise.
     */
    get quizExerciseStatus(): QuizStatus | undefined {
        if (this.exercise!.type === ExerciseType.QUIZ) {
            return this.quizExerciseService.getStatus(this.exercise as QuizExercise);
        }
        return undefined;
    }

    private onError(error: string) {
        this.alertService.error(error);
    }

    /**
     * Used to change the boolean value for the example solution dropdown menu
     */
    changeExampleSolution() {
        this.exampleSolutionCollapsed = !this.exampleSolutionCollapsed;
    }

    // INSTRUCTOR ACTIONS
    createInstructorActions() {
        if (this.exercise?.isAtLeastTutor) {
            this.instructorActionItems = this.createTutorActions();
        }
        if (this.exercise?.isAtLeastEditor) {
            this.instructorActionItems.push(...this.createEditorActions());
        }
        if (this.exercise?.isAtLeastInstructor && this.QUIZ_ENDED_STATUS.includes(this.quizExerciseStatus)) {
            this.instructorActionItems.push(this.getReEvaluateItem());
        }
    }

    createTutorActions(): InstructorActionItem[] {
        const tutorActionItems = [...this.getDefaultItems()];
        if (this.exercise?.type === ExerciseType.QUIZ) {
            tutorActionItems.push(...this.getQuizItems());
        } else {
            tutorActionItems.push(this.getParticipationItem());
        }
        return tutorActionItems;
    }

    getDefaultItems(): InstructorActionItem[] {
        return [
            {
                routerLink: `${this.baseResource}`,
                icon: faEye,
                translation: 'entity.action.view',
            },
            {
                routerLink: `${this.baseResource}scores`,
                icon: faTable,
                translation: 'entity.action.scores',
            },
        ];
    }

    getQuizItems(): InstructorActionItem[] {
        return [
            {
                routerLink: `${this.baseResource}preview`,
                icon: faEye,
                translation: 'artemisApp.quizExercise.preview',
            },
            {
                routerLink: `${this.baseResource}solution`,
                icon: faEye,
                translation: 'artemisApp.quizExercise.solution',
            },
        ];
    }

    getParticipationItem(): InstructorActionItem {
        return {
            routerLink: `${this.baseResource}participations`,
            icon: faListAlt,
            translation: 'artemisApp.exercise.participations',
        };
    }

    createEditorActions(): InstructorActionItem[] {
        const editorItems: InstructorActionItem[] = [];
        if (this.exercise?.type === ExerciseType.QUIZ) {
            editorItems.push(this.getStatisticItem('quiz-point-statistic'));
            if (this.QUIZ_EDITABLE_STATUS.includes(this.quizExerciseStatus)) {
                editorItems.push(this.getQuizEditItem());
            }
        } else if (this.exercise?.type === ExerciseType.MODELING) {
            editorItems.push(this.getStatisticItem('exercise-statistics'));
        } else if (this.exercise?.type === ExerciseType.PROGRAMMING) {
            editorItems.push(this.getGradingItem());
        }
        return editorItems;
    }

    getStatisticItem(routerLink: string): InstructorActionItem {
        return {
            routerLink: `${this.baseResource}${routerLink}`,
            icon: faSignal,
            translation: 'artemisApp.courseOverview.exerciseDetails.instructorActions.statistics',
        };
    }

    getGradingItem(): InstructorActionItem {
        return {
            routerLink: `${this.baseResource}grading/test-cases`,
            icon: faFileSignature,
            translation: 'artemisApp.programmingExercise.configureGrading.shortTitle',
        };
    }

    getQuizEditItem(): InstructorActionItem {
        return {
            routerLink: `${this.baseResource}edit`,
            icon: faWrench,
            translation: 'entity.action.edit',
        };
    }

    getReEvaluateItem(): InstructorActionItem {
        return {
            routerLink: `${this.baseResource}re-evaluate`,
            icon: faWrench,
            translation: 'entity.action.re-evaluate',
        };
    }

    ngOnDestroy() {
        this.participationUpdateListener?.unsubscribe();
        this.studentParticipations?.forEach((participation) => {
            if (participation.id && this.exercise) {
                this.participationWebsocketService.unsubscribeForLatestResultOfParticipation(participation.id, this.exercise);
            }
        });

        this.teamAssignmentUpdateListener?.unsubscribe();
        this.submissionSubscription?.unsubscribe();
        this.paramsSubscription?.unsubscribe();
        this.profileSubscription?.unsubscribe();
    }
}
