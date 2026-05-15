import { TestBed } from '@angular/core/testing';
import { FeedbackService, FeedbackItem } from './feedback.service';

describe('FeedbackService', () => {
  let service: FeedbackService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [FeedbackService] });
    service = TestBed.inject(FeedbackService);
  });

  const sampleInput = {
    selectedText: 'belangrijk',
    contextBefore: 'voor ',
    contextAfter: ' staat',
    headingPath: ['Intro', 'Setup'],
    feedback: 'mijn opmerking'
  };

  it('start met lege lijst', () => {
    service.setCurrentFile('/test.md');
    expect(service.getItems()).toEqual([]);
  });

  it('voegt item toe met status open en gegenereerde id', () => {
    service.setCurrentFile('/test.md');
    const added = service.add(sampleInput);
    expect(added.id).toBeDefined();
    expect(added.status).toBe('open');
    expect(added.createdAt).toBeDefined();
    expect(service.getItems().length).toBe(1);
  });

  it('persisteert per filePath in localStorage', () => {
    service.setCurrentFile('/a.md');
    service.add(sampleInput);
    service.setCurrentFile('/b.md');
    expect(service.getItems()).toEqual([]);
    service.add({ ...sampleInput, feedback: 'andere' });
    expect(service.getItems().length).toBe(1);
    service.setCurrentFile('/a.md');
    expect(service.getItems().length).toBe(1);
    expect(service.getItems()[0].feedback).toBe('mijn opmerking');
  });

  it('update wijzigt een specifiek item', () => {
    service.setCurrentFile('/test.md');
    const added = service.add(sampleInput);
    service.update(added.id, { status: 'processed' });
    expect(service.getItems()[0].status).toBe('processed');
  });

  it('remove verwijdert een specifiek item', () => {
    service.setCurrentFile('/test.md');
    const added = service.add(sampleInput);
    service.remove(added.id);
    expect(service.getItems()).toEqual([]);
  });

  it('removeByStatus verwijdert alleen items met die status', () => {
    service.setCurrentFile('/test.md');
    const a = service.add(sampleInput);
    const b = service.add(sampleInput);
    service.update(a.id, { status: 'processed' });
    service.removeByStatus('processed');
    expect(service.getItems().length).toBe(1);
    expect(service.getItems()[0].id).toBe(b.id);
  });

  it('emit items$ bij elke wijziging', (done) => {
    service.setCurrentFile('/test.md');
    const emissions: FeedbackItem[][] = [];
    service.items$.subscribe(items => {
      emissions.push(items);
      if (emissions.length === 3) {
        expect(emissions[0].length).toBe(0);
        expect(emissions[1].length).toBe(1);
        expect(emissions[2].length).toBe(0);
        done();
      }
    });
    const added = service.add(sampleInput);
    service.remove(added.id);
  });

  it('herlaadt opgeslagen items bij setCurrentFile', () => {
    service.setCurrentFile('/test.md');
    service.add(sampleInput);
    const service2 = new FeedbackService();
    service2.setCurrentFile('/test.md');
    expect(service2.getItems().length).toBe(1);
  });
});
