package de.tum.cit.aet.artemis.quiz.web;

import static de.tum.cit.aet.artemis.core.config.Constants.PROFILE_CORE;

import java.time.ZonedDateTime;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.json.MappingJacksonValue;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import de.tum.cit.aet.artemis.assessment.domain.Result;
import de.tum.cit.aet.artemis.assessment.repository.ResultRepository;
import de.tum.cit.aet.artemis.core.domain.User;
import de.tum.cit.aet.artemis.core.exception.AccessForbiddenException;
import de.tum.cit.aet.artemis.core.repository.UserRepository;
import de.tum.cit.aet.artemis.core.security.annotations.enforceRoleInExercise.EnforceAtLeastStudentInExercise;
import de.tum.cit.aet.artemis.exercise.domain.participation.StudentParticipation;
import de.tum.cit.aet.artemis.exercise.service.ParticipationService;
import de.tum.cit.aet.artemis.quiz.domain.QuizExercise;
import de.tum.cit.aet.artemis.quiz.repository.QuizExerciseRepository;
import de.tum.cit.aet.artemis.quiz.repository.QuizSubmissionRepository;
import de.tum.cit.aet.artemis.quiz.service.QuizBatchService;

/**
 * REST controller for managing quiz participations.
 */
@Profile(PROFILE_CORE)
@RestController
@RequestMapping("api/")
public class QuizParticipationResource {

    private static final Logger log = LoggerFactory.getLogger(QuizParticipationResource.class);

    private final QuizExerciseRepository quizExerciseRepository;

    private final ParticipationService participationService;

    private final UserRepository userRepository;

    private final ResultRepository resultRepository;

    private final QuizSubmissionRepository quizSubmissionRepository;

    private final QuizBatchService quizBatchService;

    public QuizParticipationResource(QuizExerciseRepository quizExerciseRepository, ParticipationService participationService, UserRepository userRepository,
            ResultRepository resultRepository, QuizSubmissionRepository quizSubmissionRepository, QuizBatchService quizBatchService) {
        this.quizExerciseRepository = quizExerciseRepository;
        this.participationService = participationService;
        this.userRepository = userRepository;
        this.resultRepository = resultRepository;
        this.quizSubmissionRepository = quizSubmissionRepository;
        this.quizBatchService = quizBatchService;
    }

    /**
     * POST /quiz-exercises/{exerciseId}/start-participation : start the quiz exercise participation
     * TODO: This endpoint is also called when viewing the result of a quiz exercise.
     * TODO: This does not make any sense, as the participation is already started.
     *
     * @param exerciseId the id of the quiz exercise
     * @return The created participation
     */
    @PostMapping("quiz-exercises/{exerciseId}/start-participation")
    @EnforceAtLeastStudentInExercise
    public ResponseEntity<MappingJacksonValue> startParticipation(@PathVariable Long exerciseId) {
        log.debug("REST request to start quiz exercise participation : {}", exerciseId);
        QuizExercise exercise = quizExerciseRepository.findByIdWithQuestionsElseThrow(exerciseId);

        if (exercise.getReleaseDate() != null && exercise.getReleaseDate().isAfter(ZonedDateTime.now())) {
            throw new AccessForbiddenException("Students cannot start an exercise before the release date");
        }

        User user = userRepository.getUserWithGroupsAndAuthorities();

        var quizBatch = quizBatchService.getQuizBatchForStudentByLogin(exercise, user.getLogin());
        exercise.setQuizBatches(quizBatch.stream().collect(Collectors.toSet()));

        StudentParticipation participation = participationService.startExercise(exercise, user, true);

        // NOTE: starting exercise prevents that two participation will exist, but ensures that a submission is created
        var result = resultRepository.findFirstByParticipationIdAndRatedOrderByCompletionDateDesc(participation.getId(), true).orElse(new Result());
        if (result.getId() == null) {
            // Load the live submission of the participation
            result.setSubmission(quizSubmissionRepository.findWithEagerSubmittedAnswersByParticipationId(participation.getId()).stream().findFirst().orElseThrow());
        }
        else {
            // Load the actual submission of the result
            result.setSubmission(quizSubmissionRepository.findWithEagerSubmittedAnswersByResultId(result.getId()).orElseThrow());
        }

        participation.setResults(Set.of(result));
        participation.setExercise(exercise);

        var view = exercise.viewForStudentsInQuizExercise(quizBatch.orElse(null));
        MappingJacksonValue value = new MappingJacksonValue(participation);
        value.setSerializationView(view);
        return new ResponseEntity<>(value, HttpStatus.OK);
    }
}
