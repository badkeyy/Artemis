import { Component, OnChanges, input } from '@angular/core';
import { Result } from 'app/entities/result.model';
import { Exercise, ExerciseType } from 'app/entities/exercise.model';
import { MissingResultInformation, evaluateTemplateStatus, getResultIconClass, getTextColorClass } from 'app/exercises/shared/result/result.utils';

export const MAX_RESULT_HISTORY_LENGTH = 5;

// Modal -> Result details view
@Component({
    selector: 'jhi-result-history',
    templateUrl: './result-history.component.html',
    styleUrls: ['./result-history.scss'],
})
export class ResultHistoryComponent implements OnChanges {
    readonly getTextColorClass = getTextColorClass;
    readonly getResultIconClass = getResultIconClass;
    readonly evaluateTemplateStatus = evaluateTemplateStatus;
    readonly MissingResultInfo = MissingResultInformation;

    results = input.required<Result[]>();
    exercise = input<Exercise>();
    selectedResultId = input<number>();

    showPreviousDivider = false;
    displayedResults: Result[];
    movedLastRatedResult: boolean;

    ngOnChanges(): void {
        this.showPreviousDivider = this.results().length > MAX_RESULT_HISTORY_LENGTH;
        if (this.exercise()?.type === ExerciseType.TEXT || this.exercise()?.type === ExerciseType.MODELING) {
            this.displayedResults = this.results().filter((result) => result.successful !== undefined);
        } else {
            this.displayedResults = this.results();
        }
        const successfulResultsLength = this.displayedResults.length;
        if (successfulResultsLength > MAX_RESULT_HISTORY_LENGTH) {
            this.displayedResults = this.displayedResults.slice(successfulResultsLength - MAX_RESULT_HISTORY_LENGTH);
            const lastRatedResult = this.results()
                .filter((result) => result.rated)
                .last();
            if (!this.displayedResults.first()?.rated && lastRatedResult) {
                this.displayedResults[0] = lastRatedResult;
                this.movedLastRatedResult = true;
            }
        }
    }
}
