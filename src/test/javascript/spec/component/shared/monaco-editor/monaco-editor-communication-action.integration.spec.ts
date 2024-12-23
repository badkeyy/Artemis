import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MockProvider } from 'ng-mocks';
import { MetisService } from 'app/shared/metis/metis.service';
import { LectureService } from 'app/lecture/lecture.service';
import { HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { CourseManagementService } from 'app/course/manage/course-management.service';
import { ChannelService } from 'app/shared/metis/conversations/channel.service';
import { MockMetisService } from '../../../helpers/mocks/service/mock-metis-service.service';
import { MockTranslateService } from '../../../helpers/mocks/service/mock-translate.service';
import { TranslateService } from '@ngx-translate/core';
import { MockLocalStorageService } from '../../../helpers/mocks/service/mock-local-storage.service';
import { LocalStorageService } from 'ngx-webstorage';
import { MockResizeObserver } from '../../../helpers/mocks/service/mock-resize-observer';
import { ChannelReferenceAction } from 'app/shared/monaco-editor/model/actions/communication/channel-reference.action';
import { UserMentionAction } from 'app/shared/monaco-editor/model/actions/communication/user-mention.action';
import { ExerciseReferenceAction } from 'app/shared/monaco-editor/model/actions/communication/exercise-reference.action';
import { metisExamChannelDTO, metisExerciseChannelDTO, metisGeneralChannelDTO, metisTutor, metisUser1, metisUser2 } from '../../../helpers/sample/metis-sample-data';
import { TextEditorAction } from 'app/shared/monaco-editor/model/actions/text-editor-action.model';
import * as monaco from 'monaco-editor';
import { MonacoEditorComponent } from 'app/shared/monaco-editor/monaco-editor.component';
import { ChannelIdAndNameDTO } from 'app/entities/metis/conversation/channel.model';
import { User } from 'app/core/user/user.model';
import { Exercise } from 'app/entities/exercise.model';
import { Lecture } from 'app/entities/lecture.model';
import { LectureAttachmentReferenceAction } from 'app/shared/monaco-editor/model/actions/communication/lecture-attachment-reference.action';
import { LectureUnitType } from 'app/entities/lecture-unit/lectureUnit.model';
import { ReferenceType } from 'app/shared/metis/metis.util';
import { Attachment } from 'app/entities/attachment.model';
import dayjs from 'dayjs/esm';
import { FaqReferenceAction } from 'app/shared/monaco-editor/model/actions/communication/faq-reference.action';
import { Faq } from 'app/entities/faq.model';

describe('MonacoEditorCommunicationActionIntegration', () => {
    let comp: MonacoEditorComponent;
    let fixture: ComponentFixture<MonacoEditorComponent>;
    let metisService: MetisService;
    let courseManagementService: CourseManagementService;
    let channelService: ChannelService;
    let lectureService: LectureService;
    let provider: monaco.languages.CompletionItemProvider;

    // Actions
    let channelReferenceAction: ChannelReferenceAction;
    let userMentionAction: UserMentionAction;
    let exerciseReferenceAction: ExerciseReferenceAction;
    let faqReferenceAction: FaqReferenceAction;

    beforeEach(() => {
        return TestBed.configureTestingModule({
            imports: [MonacoEditorComponent],
            providers: [
                { provide: MetisService, useClass: MockMetisService },
                { provide: TranslateService, useClass: MockTranslateService },
                { provide: LocalStorageService, useClass: MockLocalStorageService },
                MockProvider(LectureService),
                MockProvider(CourseManagementService),
                MockProvider(ChannelService),
            ],
        })
            .compileComponents()
            .then(() => {
                global.ResizeObserver = jest.fn().mockImplementation((callback: ResizeObserverCallback) => {
                    return new MockResizeObserver(callback);
                });
                fixture = TestBed.createComponent(MonacoEditorComponent);
                comp = fixture.componentInstance;
                metisService = TestBed.inject(MetisService);
                courseManagementService = TestBed.inject(CourseManagementService);
                lectureService = TestBed.inject(LectureService);
                channelService = TestBed.inject(ChannelService);
                channelReferenceAction = new ChannelReferenceAction(metisService, channelService);
                userMentionAction = new UserMentionAction(courseManagementService, metisService);
                exerciseReferenceAction = new ExerciseReferenceAction(metisService);
                faqReferenceAction = new FaqReferenceAction(metisService);
            });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const registerActionWithCompletionProvider = (action: TextEditorAction, triggerCharacter?: string) => {
        const registerCompletionProviderStub = jest.spyOn(monaco.languages, 'registerCompletionItemProvider').mockImplementation();
        comp.registerAction(action);
        expect(registerCompletionProviderStub).toHaveBeenCalledOnce();
        provider = registerCompletionProviderStub.mock.calls[0][1];
        expect(provider).toBeDefined();
        expect(provider.provideCompletionItems).toBeDefined();
        if (triggerCharacter) {
            expect(provider.triggerCharacters).toContain(triggerCharacter);
        }
    };

    describe.each([
        { actionId: ChannelReferenceAction.ID, defaultInsertText: '#', triggerCharacter: '#' },
        { actionId: UserMentionAction.ID, defaultInsertText: '@', triggerCharacter: '@' },
        { actionId: ExerciseReferenceAction.ID, defaultInsertText: '/exercise', triggerCharacter: '/' },
        { actionId: FaqReferenceAction.ID, defaultInsertText: '/faq', triggerCharacter: '/' },
    ])('Suggestions and default behavior for $actionId', ({ actionId, defaultInsertText, triggerCharacter }) => {
        let action: ChannelReferenceAction | UserMentionAction | ExerciseReferenceAction | FaqReferenceAction;
        let channels: ChannelIdAndNameDTO[];
        let users: User[];
        let exercises: Exercise[];
        let faqs: Faq[];

        beforeEach(() => {
            fixture.detectChanges();
            comp.changeModel('initial', '');
            channels = [metisGeneralChannelDTO, metisExamChannelDTO, metisExerciseChannelDTO];
            channelReferenceAction.cachedChannels = channels;
            users = [metisUser1, metisUser2, metisTutor];
            jest.spyOn(courseManagementService, 'searchMembersForUserMentions').mockReturnValue(of(new HttpResponse({ body: users, status: 200 })));
            exercises = metisService.getCourse().exercises!;
            faqs = metisService.getCourse().faqs!;

            switch (actionId) {
                case ChannelReferenceAction.ID:
                    action = channelReferenceAction;
                    break;
                case UserMentionAction.ID:
                    action = userMentionAction;
                    break;
                case ExerciseReferenceAction.ID:
                    action = exerciseReferenceAction;
                    break;
                case FaqReferenceAction.ID:
                    action = faqReferenceAction;
                    break;
            }
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('should suggest no values for the wrong model', async () => {
            registerActionWithCompletionProvider(action, triggerCharacter);
            comp.changeModel('other', '#ch');
            const suggestions = await provider.provideCompletionItems(comp.models[1], new monaco.Position(1, 4), {} as any, {} as any);
            expect(suggestions).toBeUndefined();
        });

        it('should suggest no values if the user is not typing a reference', async () => {
            comp.setText('some text that is no reference');
            registerActionWithCompletionProvider(action, triggerCharacter);
            const providerResult = await provider.provideCompletionItems(comp.models[0], new monaco.Position(1, 4), {} as any, {} as any);
            expect(providerResult).toBeUndefined();
        });

        it('should insert the correct default text when executed', () => {
            registerActionWithCompletionProvider(action, triggerCharacter);
            action.executeInCurrentEditor();
            expect(comp.getText()).toBe(defaultInsertText);
        });

        const checkChannelSuggestions = (suggestions: monaco.languages.CompletionItem[], channels: ChannelIdAndNameDTO[]) => {
            expect(suggestions).toHaveLength(channels.length);
            suggestions.forEach((suggestion, index) => {
                expect(suggestion.label).toBe(`#${channels[index].name}`);
                expect(suggestion.insertText).toBe(`[channel]${channels[index].name}(${channels[index].id})[/channel]`);
                expect(suggestion.detail).toBe(action.label);
            });
        };

        const checkUserSuggestions = (suggestions: monaco.languages.CompletionItem[], users: User[]) => {
            expect(suggestions).toHaveLength(users.length);
            suggestions.forEach((suggestion, index) => {
                expect(suggestion.label).toBe(`@${users[index].name}`);
                expect(suggestion.insertText).toBe(`[user]${users[index].name}(${users[index].login})[/user]`);
                expect(suggestion.detail).toBe(action.label);
            });
        };

        const checkExerciseSuggestions = (suggestions: monaco.languages.CompletionItem[], exercises: Exercise[]) => {
            expect(suggestions).toHaveLength(exercises.length);
            suggestions.forEach((suggestion, index) => {
                expect(suggestion.label).toBe(`/exercise ${exercises[index].title}`);
                expect(suggestion.insertText).toBe(
                    `[${exercises[index].type}]${exercises[index].title}(${metisService.getLinkForExercise(exercises[index].id!.toString())})[/${exercises[index].type}]`,
                );
                expect(suggestion.detail).toBe(exercises[index].type);
            });
        };

        const checkFaqSuggestions = (suggestions: monaco.languages.CompletionItem[], faqs: Faq[]) => {
            expect(suggestions).toHaveLength(faqs.length);
            suggestions.forEach((suggestion, index) => {
                expect(suggestion.label).toBe(`/faq ${faqs[index].questionTitle}`);
                expect(suggestion.insertText).toBe(`[faq]${faqs[index].questionTitle}(${metisService.getLinkForFaq()}?faqId=${faqs[index].id})[/faq]`);
                expect(suggestion.detail).toBe('faq');
            });
        };

        it.each(['', 'ex'])('should suggest the correct values if the user is typing a reference (suffix "%s")', async (referenceSuffix: string) => {
            const reference = triggerCharacter + referenceSuffix;
            comp.setText(reference);
            const column = reference.length + 1;
            registerActionWithCompletionProvider(action, triggerCharacter);
            const providerResult = await provider.provideCompletionItems(comp.models[0], new monaco.Position(1, column), {} as any, {} as any);
            expect(providerResult).toBeDefined();
            expect(providerResult!.incomplete).toBe(actionId === UserMentionAction.ID);
            const suggestions = providerResult!.suggestions;
            switch (actionId) {
                case ChannelReferenceAction.ID:
                    checkChannelSuggestions(suggestions, channels);
                    break;
                case UserMentionAction.ID:
                    checkUserSuggestions(suggestions, users);
                    break;
                case ExerciseReferenceAction.ID:
                    checkExerciseSuggestions(suggestions, exercises);
                    break;
                case FaqReferenceAction.ID:
                    checkFaqSuggestions(suggestions, faqs);
                    break;
            }
        });
    });

    describe('ChannelReferenceAction', () => {
        it('should use cached channels if available', async () => {
            const channels: ChannelIdAndNameDTO[] = [metisGeneralChannelDTO, metisExamChannelDTO, metisExerciseChannelDTO];
            channelReferenceAction.cachedChannels = channels;
            const getChannelsSpy = jest.spyOn(channelService, 'getPublicChannelsOfCourse');
            fixture.detectChanges();
            comp.registerAction(channelReferenceAction);
            expect(await channelReferenceAction.fetchChannels()).toBe(channels);
            expect(getChannelsSpy).not.toHaveBeenCalled();
        });

        it('should load and cache channels if none are cached', async () => {
            const channels: ChannelIdAndNameDTO[] = [metisGeneralChannelDTO, metisExamChannelDTO, metisExerciseChannelDTO];
            const getChannelsStub = jest.spyOn(channelService, 'getPublicChannelsOfCourse').mockReturnValue(of(new HttpResponse({ body: channels, status: 200 })));
            fixture.detectChanges();
            comp.registerAction(channelReferenceAction);
            expect(await channelReferenceAction.fetchChannels()).toBe(channels);
            expect(getChannelsStub).toHaveBeenCalledExactlyOnceWith(metisService.getCourse().id!);
            expect(channelReferenceAction.cachedChannels).toBe(channels);
        });

        it('should insert # for channel references', () => {
            fixture.detectChanges();
            comp.registerAction(channelReferenceAction);
            channelReferenceAction.executeInCurrentEditor();
            expect(comp.getText()).toBe('#');
        });
    });

    describe('ExerciseReferenceAction (edge cases)', () => {
        it('should initialize with empty values if exercises are not available', () => {
            jest.spyOn(metisService, 'getCourse').mockReturnValue({ exercises: undefined } as any);
            fixture.detectChanges();
            comp.registerAction(exerciseReferenceAction);
            expect(exerciseReferenceAction.getValues()).toEqual([]);
        });

        it('should insert / for faq references', () => {
            fixture.detectChanges();
            comp.registerAction(faqReferenceAction);
            faqReferenceAction.executeInCurrentEditor();
            expect(comp.getText()).toBe('/faq');
        });
    });

    describe('FaqReferenceAction', () => {
        it('should initialize with empty values if faqs are not available', () => {
            jest.spyOn(metisService, 'getCourse').mockReturnValue({ faqs: undefined } as any);

            fixture.detectChanges();
            comp.registerAction(faqReferenceAction);
            expect(faqReferenceAction.getValues()).toEqual([]);
        });
    });

    describe('LectureAttachmentReferenceAction', () => {
        let lectures: Lecture[];
        let lectureAttachmentReferenceAction: LectureAttachmentReferenceAction;

        beforeEach(() => {
            lectures = metisService.getCourse().lectures!;
            jest.spyOn(lectureService, 'findAllByCourseIdWithSlides').mockReturnValue(of(new HttpResponse({ body: lectures, status: 200 })));
            lectureAttachmentReferenceAction = new LectureAttachmentReferenceAction(metisService, lectureService);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('should correctly initialize lecturesWithDetails', () => {
            fixture.detectChanges();
            comp.registerAction(lectureAttachmentReferenceAction);

            const lecturesWithDetails = lectures.map((lecture) => ({
                id: lecture.id!,
                title: lecture.title!,
                attachmentUnits: lecture.lectureUnits?.filter((unit) => unit.type === LectureUnitType.ATTACHMENT),
                attachments: lecture.attachments,
            }));

            expect(lectureAttachmentReferenceAction.lecturesWithDetails).toEqual(lecturesWithDetails);
        });

        it('should error on unsupported reference type', () => {
            fixture.detectChanges();
            comp.registerAction(lectureAttachmentReferenceAction);
            const executeAction = () =>
                lectureAttachmentReferenceAction.executeInCurrentEditor({ reference: ReferenceType.PROGRAMMING, lecture: lectureAttachmentReferenceAction.lecturesWithDetails[0] });
            expect(executeAction).toThrow(Error);
        });

        it('should reference a lecture', () => {
            fixture.detectChanges();
            comp.registerAction(lectureAttachmentReferenceAction);
            const lecture = lectureAttachmentReferenceAction.lecturesWithDetails[0];
            lectureAttachmentReferenceAction.executeInCurrentEditor({ reference: ReferenceType.LECTURE, lecture });
            expect(comp.getText()).toBe(`[lecture]${lecture.title}(${metisService.getLinkForLecture(lecture.id.toString())})[/lecture]`);
        });

        it('should reference an attachment without brackets', () => {
            fixture.detectChanges();

            const attachmentNameWithBrackets = 'Test (File) With [Brackets] And (More) [Bracket(s)]';
            const attachmentNameWithoutBrackets = 'Test File With Brackets And More Brackets';

            const newAttachment = {
                id: 53,
                name: attachmentNameWithBrackets,
                link: '/api/files/attachments/lecture/4/Mein_Test_PDF3.pdf',
                version: 1,
                uploadDate: dayjs('2019-05-07T08:49:59+02:00'),
                attachmentType: 'FILE',
            } as Attachment;

            comp.registerAction(lectureAttachmentReferenceAction);
            const lecture = lectureAttachmentReferenceAction.lecturesWithDetails[0];
            const shortLink = newAttachment.link?.split('attachments/')[1];
            lectureAttachmentReferenceAction.executeInCurrentEditor({ reference: ReferenceType.ATTACHMENT, lecture: lecture, attachment: newAttachment });
            expect(comp.getText()).toBe(`[attachment]${attachmentNameWithoutBrackets}(${shortLink})[/attachment]`);
        });

        it('should reference a lecture without brackets', () => {
            fixture.detectChanges();

            const lectureNameWithBrackets = 'Test (Lecture) With [Brackets] And (More) [Bracket(s)]';
            const lectureNameWithoutBrackets = 'Test Lecture With Brackets And More Brackets';

            comp.registerAction(lectureAttachmentReferenceAction);
            const lecture = lectureAttachmentReferenceAction.lecturesWithDetails[0];
            const previousTitle = lecture.title;
            lecture.title = lectureNameWithBrackets;
            lectureAttachmentReferenceAction.executeInCurrentEditor({ reference: ReferenceType.LECTURE, lecture });
            lecture.title = previousTitle;
            expect(comp.getText()).toBe(`[lecture]${lectureNameWithoutBrackets}(${metisService.getLinkForLecture(lecture.id.toString())})[/lecture]`);
        });

        it('should reference an attachment unit without brackets', () => {
            fixture.detectChanges();

            const attachmentUnitNameWithBrackets = 'Test (AttachmentUnit) With [Brackets] And (More) [Bracket(s)]';
            const attachmentUnitNameWithoutBrackets = 'Test AttachmentUnit With Brackets And More Brackets';

            comp.registerAction(lectureAttachmentReferenceAction);
            const lecture = lectureAttachmentReferenceAction.lecturesWithDetails[2];
            const attachmentUnit = lecture.attachmentUnits![0];
            const previousName = attachmentUnit.name;
            attachmentUnit.name = attachmentUnitNameWithBrackets;
            const attachmentUnitFileName = 'Metis-Attachment.pdf';
            lectureAttachmentReferenceAction.executeInCurrentEditor({
                reference: ReferenceType.ATTACHMENT_UNITS,
                lecture,
                attachmentUnit,
            });
            attachmentUnit.name = previousName;
            expect(comp.getText()).toBe(`[lecture-unit]${attachmentUnitNameWithoutBrackets}(${attachmentUnitFileName})[/lecture-unit]`);
        });

        it('should reference an attachment', () => {
            fixture.detectChanges();
            comp.registerAction(lectureAttachmentReferenceAction);
            const lecture = lectureAttachmentReferenceAction.lecturesWithDetails[0];
            const attachment = lecture.attachments![0];
            const attachmentFileName = 'Metis-Attachment.pdf';
            lectureAttachmentReferenceAction.executeInCurrentEditor({
                reference: ReferenceType.ATTACHMENT,
                lecture,
                attachment,
            });
            expect(comp.getText()).toBe(`[attachment]${attachment.name}(${attachmentFileName})[/attachment]`);
        });

        it('should error when trying to reference a nonexistent attachment', () => {
            fixture.detectChanges();
            comp.registerAction(lectureAttachmentReferenceAction);
            const lecture = lectureAttachmentReferenceAction.lecturesWithDetails[0];
            const executeAction = () =>
                lectureAttachmentReferenceAction.executeInCurrentEditor({
                    reference: ReferenceType.ATTACHMENT,
                    lecture,
                    attachment: undefined,
                });
            expect(executeAction).toThrow(Error);
        });

        it('should reference an attachment unit', () => {
            fixture.detectChanges();
            comp.registerAction(lectureAttachmentReferenceAction);
            const lecture = lectureAttachmentReferenceAction.lecturesWithDetails[2];
            const attachmentUnit = lecture.attachmentUnits![0];
            const attachmentUnitFileName = 'Metis-Attachment.pdf';
            lectureAttachmentReferenceAction.executeInCurrentEditor({
                reference: ReferenceType.ATTACHMENT_UNITS,
                lecture,
                attachmentUnit,
            });
            expect(comp.getText()).toBe(`[lecture-unit]${attachmentUnit.name}(${attachmentUnitFileName})[/lecture-unit]`);
        });

        it('should error when trying to reference a nonexistent attachment unit', () => {
            fixture.detectChanges();
            comp.registerAction(lectureAttachmentReferenceAction);
            const lecture = lectureAttachmentReferenceAction.lecturesWithDetails[0];
            const executeAction = () =>
                lectureAttachmentReferenceAction.executeInCurrentEditor({
                    reference: ReferenceType.ATTACHMENT_UNITS,
                    lecture,
                    attachmentUnit: undefined,
                });
            expect(executeAction).toThrow(Error);
        });

        it('should reference a slide', () => {
            fixture.detectChanges();
            comp.registerAction(lectureAttachmentReferenceAction);
            const lecture = lectureAttachmentReferenceAction.lecturesWithDetails[2];
            const attachmentUnit = lecture.attachmentUnits![0];
            const slide = attachmentUnit.slides![0];
            const slideLink = 'slides';
            lectureAttachmentReferenceAction.executeInCurrentEditor({
                reference: ReferenceType.SLIDE,
                lecture,
                attachmentUnit,
                slide,
            });
            expect(comp.getText()).toBe(`[slide]${attachmentUnit.name} Slide ${slide.slideNumber}(${slideLink})[/slide]`);
        });

        it('should error when incorrectly referencing a slide', () => {
            fixture.detectChanges();
            comp.registerAction(lectureAttachmentReferenceAction);
            const lecture = lectureAttachmentReferenceAction.lecturesWithDetails[2];
            const attachmentUnit = lecture.attachmentUnits![0];
            const executeAction = () =>
                lectureAttachmentReferenceAction.executeInCurrentEditor({
                    reference: ReferenceType.SLIDE,
                    lecture,
                    attachmentUnit,
                    slide: undefined,
                });
            expect(executeAction).toThrow(Error);
        });
    });
});
