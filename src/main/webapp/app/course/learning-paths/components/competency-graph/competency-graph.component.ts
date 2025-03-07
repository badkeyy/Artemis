import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { NgxGraphModule, NgxGraphZoomOptions } from '@swimlane/ngx-graph';
import { Subject } from 'rxjs';
import { CompetencyGraphDTO } from 'app/entities/competency/learning-path.model';
import { CompetencyNodeComponent, SizeUpdate } from 'app/course/learning-paths/components/competency-node/competency-node.component';

@Component({
    selector: 'jhi-competency-graph',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CompetencyNodeComponent, NgxGraphModule],
    templateUrl: './competency-graph.component.html',
    styleUrl: './competency-graph.component.scss',
})
export class CompetencyGraphComponent {
    readonly competencyGraph = input.required<CompetencyGraphDTO>();

    private readonly internalCompetencyGraph = signal<CompetencyGraphDTO>({
        nodes: [],
        edges: [],
    });
    readonly nodes = computed(() => this.internalCompetencyGraph().nodes);
    readonly edges = computed(() => {
        return (
            this.internalCompetencyGraph().edges?.map((edge) => ({
                ...edge,
                id: `edge-${edge.id}`,
            })) || []
        );
    });

    readonly update$ = new Subject<boolean>();
    readonly center$ = new Subject<boolean>();
    readonly zoomToFit$ = new Subject<NgxGraphZoomOptions>();

    constructor() {
        effect(() => this.internalCompetencyGraph.set(this.competencyGraph()), { allowSignalWrites: true });
    }

    setNodeDimension(sizeUpdate: SizeUpdate): void {
        this.internalCompetencyGraph.update(({ nodes, edges }) => {
            return {
                nodes: nodes.map((node) => {
                    if (node.id === sizeUpdate.id) {
                        node.dimension = sizeUpdate.dimension;
                    }
                    return node;
                }),
                edges: edges,
            };
        });
    }
}
